import React, {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  HeadingText,
  Icon,
  NerdGraphQuery,
  Switch,
  Tooltip,
  useEntitiesByGuidsQuery,
  useNerdletState,
} from 'nr1';

import { EmptyBlock, SignalDetailSidebar, Stage } from '../';
import {
  MODES,
  SIGNAL_TYPES,
  SIGNAL_EXPAND,
  COMPONENTS,
  UI_CONTENT,
} from '../../constants';
import {
  addSignalStatuses,
  alertConditionsStatusGQL,
  alertsStatusFromQueryResults,
  alertsTree,
  annotateStageWithStatuses,
  entitiesDetailsFromQueryResults,
  guidsToArray,
  uniqueSignalGuidsInStages,
} from '../../utils';
import {
  AppContext,
  FlowContext,
  FlowDispatchContext,
  SelectionsContext,
  SignalsClassificationsContext,
  SignalsContext,
  StagesContext,
  useSidebar,
} from '../../contexts';
import { FLOW_DISPATCH_COMPONENTS, FLOW_DISPATCH_TYPES } from '../../reducers';
import { queryFromGuidsArray } from '../../queries';

const MAX_GUIDS_PER_CALL = 25;

const Stages = forwardRef(({ mode = MODES.INLINE, saveFlow }, ref) => {
  const { stages = [] } = useContext(FlowContext);
  const dispatch = useContext(FlowDispatchContext);
  const { accounts } = useContext(AppContext);
  const [guids, setGuids] = useState({});
  const [statuses, setStatuses] = useState({});
  const [stagesData, setStagesData] = useState({ stages });
  const [signalsDetails, setSignalsDetails] = useState({});
  const [selections, setSelections] = useState({});
  const [classifications, setClassifications] = useState({});
  const [signalExpandOption, setSignalExpandOption] = useState(0); // bitwise: (00000001) = unhealthy signals ;; (00000010) = critical signals ;; (00000100)= all signals
  const dragItemIndex = useRef();
  const dragOverItemIndex = useRef();
  const stagesDataRef = useRef(stages);
  const { refetch: entitiesRefetchFn, ...entitiesDetails } =
    useEntitiesByGuidsQuery({
      entityGuids: guids[SIGNAL_TYPES.ENTITY] || [],
    });
  const { openSidebar, closeSidebar } = useSidebar();
  const [nerdletState, setNerdletState] = useNerdletState();

  useEffect(() => {
    if (!accounts?.length) return;
    setGuids(uniqueSignalGuidsInStages(stages, accounts));
    setStagesData(() => ({ stages: [...stages] }));
  }, [stages, accounts]);

  useEffect(() => {
    const arrayOfGuids = guidsToArray(guids, MAX_GUIDS_PER_CALL);
    const fetchSignalsDetails = async () => {
      const query = queryFromGuidsArray(arrayOfGuids);
      const { data: { actor = {} } = {} } = await NerdGraphQuery.query({
        query,
      });
      setSignalsDetails(entitiesDetailsFromQueryResults(actor));
    };

    if (arrayOfGuids.length) fetchSignalsDetails();

    const alertGuids = guids[SIGNAL_TYPES.ALERT] || [];
    if (alertGuids.length) fetchAlerts(alertGuids);

    setStatuses((s) => ({
      ...s,
      [SIGNAL_TYPES.NO_ACCESS]: (guids[SIGNAL_TYPES.NO_ACCESS] || []).reduce(
        (acc, cur) => ({ ...acc, [cur]: true }),
        {}
      ),
    }));
  }, [guids]);

  useEffect(() => {
    const {
      loading,
      data: { entities = [] },
    } = entitiesDetails;
    if (loading || !entities.length) return;
    const entitiesStatuses = statuses[SIGNAL_TYPES.ENTITY];
    if (
      entitiesStatuses &&
      entities.every(({ guid }) => guid in entitiesStatuses)
    )
      return;
    setStatuses((s) => ({
      ...s,
      [SIGNAL_TYPES.ENTITY]: entities.reduce(
        (acc, { guid, ...entity }) => ({ ...acc, [guid]: entity }),
        {}
      ),
    }));
  }, [entitiesDetails]);

  useEffect(() => {
    const {
      entitiesInStepCount,
      signalsWithNoAccess,
      signalsWithNoStatus,
      signalsWithStatuses,
    } = addSignalStatuses([...stages], statuses);
    setStagesData(() => ({
      stages: signalsWithStatuses.map(annotateStageWithStatuses),
    }));
    setClassifications({
      entitiesInStepCount,
      signalsWithNoAccess,
      signalsWithNoStatus,
    });
  }, [stages, statuses]);

  useEffect(() => {
    if (nerdletState.staging) {
      const { stageId, levelId, stepId, signals = [] } = nerdletState.staging;
      const updates = (stagesDataRef.current || []).reduce(
        (acc, stage) =>
          stage.id === stageId
            ? {
                ...stage,
                levels: (stage.levels || []).map((level) =>
                  level.id === levelId
                    ? {
                        ...level,
                        steps: (level.steps || []).map((step) =>
                          step.id === stepId
                            ? {
                                ...step,
                                signals,
                              }
                            : step
                        ),
                      }
                    : level
                ),
              }
            : acc,
        null
      );
      if (updates)
        dispatch({
          type: FLOW_DISPATCH_TYPES.UPDATED,
          component: FLOW_DISPATCH_COMPONENTS.STAGE,
          componentIds: { stageId },
          updates,
          saveFlow,
        });
      setNerdletState({ staging: false });
    }
  }, [nerdletState.staging]);

  const fetchAlerts = useCallback(async (alertGuids) => {
    if (alertGuids.length) {
      const alerts = alertGuids.reduce(alertsTree, {});
      const query = alertConditionsStatusGQL(alerts);
      if (query) {
        const { data: { actor: res = {} } = {} } = await NerdGraphQuery.query({
          query,
        });
        setStatuses((s) => ({
          ...s,
          [SIGNAL_TYPES.ALERT]: alertsStatusFromQueryResults(alerts, res),
        }));
      }
    }
  }, []);

  const refetchEntities = useCallback(async () => {
    if (entitiesRefetchFn) {
      const {
        data: {
          actor: {
            entitySearch: { results: { entities = [] } = {} } = {},
          } = {},
        } = {},
      } = await entitiesRefetchFn();
      setStatuses((s) => ({
        ...s,
        [SIGNAL_TYPES.ENTITY]: entities.reduce(
          (acc, { guid, ...entity }) => ({ ...acc, [guid]: entity }),
          {}
        ),
      }));
    }
  }, [entitiesRefetchFn]);

  useEffect(() => {
    if (selections.type === COMPONENTS.SIGNAL && selections.id) {
      openSidebar({
        content: (
          <SignalDetailSidebar
            guid={selections.id}
            name={selections.data?.name}
            type={selections.data?.type}
            status={selections.data?.status}
          />
        ),
        status: selections.data?.status,
        onClose: closeSidebarHandler,
      });
    } else {
      closeSidebar();
    }
  }, [selections, closeSidebarHandler]);

  const markSelection = useCallback((type, id, data) => {
    if (!type || !id) return;
    setSelections((sel) =>
      sel.type === type && sel.id === id ? {} : { type, id, data }
    );
  }, []);

  const closeSidebarHandler = useCallback(() => setSelections({}), []);

  const updateStagesDataRef = useCallback(() => {
    stagesDataRef.current = [...stages];
  }, [stages]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: async () => {
        await refetchEntities();
        await fetchAlerts(guids[SIGNAL_TYPES.ALERT] || []);
      },
    }),
    [refetchEntities, guids]
  );

  const addStageHandler = () =>
    dispatch({
      type: FLOW_DISPATCH_TYPES.ADDED,
      component: FLOW_DISPATCH_COMPONENTS.STAGE,
      saveFlow,
    });

  const dragStartHandler = (e, index) => {
    dragItemIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const dragOverHandler = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverItemIndex.current = index;
  };

  const dropHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIndex = dragItemIndex.current;
    const targetIndex = dragOverItemIndex.current;
    dispatch({
      type: FLOW_DISPATCH_TYPES.REORDERED,
      component: FLOW_DISPATCH_COMPONENTS.STAGE,
      updates: { sourceIndex, targetIndex },
      saveFlow,
    });
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  return (
    <StagesContext.Provider
      value={{ stages: stagesData.stages, updateStagesDataRef }}
    >
      <SignalsContext.Provider value={signalsDetails}>
        <SelectionsContext.Provider value={{ selections, markSelection }}>
          <SignalsClassificationsContext.Provider value={classifications}>
            <div className="stages-header">
              <div className="heading">
                <HeadingText type={HeadingText.TYPE.HEADING_5}>
                  Stages
                </HeadingText>
                <Tooltip text={UI_CONTENT.STAGE.TOOLTIP}>
                  <Icon
                    className="info-icon"
                    type={Icon.TYPE.INTERFACE__INFO__INFO}
                  />
                </Tooltip>
              </div>
              {mode === MODES.EDIT ? (
                <Button
                  className="button-tertiary-border"
                  variant={Button.VARIANT.TERTIARY}
                  sizeType={Button.SIZE_TYPE.SMALL}
                  iconType={Button.ICON_TYPE.INTERFACE__SIGN__PLUS__V_ALTERNATE}
                  onClick={addStageHandler}
                >
                  Add a stage
                </Button>
              ) : (
                <>
                  <Switch
                    checked={signalExpandOption & SIGNAL_EXPAND.UNHEALTHY_ONLY}
                    label="Unhealthy only"
                    onChange={() =>
                      setSignalExpandOption(
                        (seo) => seo ^ SIGNAL_EXPAND.UNHEALTHY_ONLY
                      )
                    }
                  />
                  <Switch
                    checked={signalExpandOption & SIGNAL_EXPAND.CRITICAL_ONLY}
                    label="Critical only"
                    onChange={() =>
                      setSignalExpandOption(
                        (seo) => seo ^ SIGNAL_EXPAND.CRITICAL_ONLY
                      )
                    }
                  />
                </>
              )}
              {mode === MODES.INLINE && (
                <Switch
                  checked={signalExpandOption & SIGNAL_EXPAND.ALL}
                  label="Expand all steps"
                  onChange={() =>
                    setSignalExpandOption((seo) => seo ^ SIGNAL_EXPAND.ALL)
                  }
                />
              )}
            </div>
            <div className="stages">
              {(stagesData.stages || []).map(({ id }, i) => (
                <Stage
                  key={id}
                  stageId={id}
                  mode={mode}
                  signalExpandOption={signalExpandOption}
                  stageIndex={i}
                  onDragStart={(e) => dragStartHandler(e, i)}
                  onDragOver={(e) => dragOverHandler(e, i)}
                  onDrop={(e) => dropHandler(e)}
                  saveFlow={saveFlow}
                />
              ))}
              {mode === MODES.EDIT && !stagesData.stages.length ? (
                <EmptyBlock
                  title={UI_CONTENT.FLOW.NO_STAGES.TITLE}
                  description={UI_CONTENT.FLOW.NO_STAGES.DESCRIPTION}
                  actionButtonText="Add a stage"
                  onAdd={addStageHandler}
                  fullWidth
                />
              ) : null}
            </div>
          </SignalsClassificationsContext.Provider>
        </SelectionsContext.Provider>
      </SignalsContext.Provider>
    </StagesContext.Provider>
  );
});

Stages.propTypes = {
  mode: PropTypes.oneOf(Object.values(MODES)),
  saveFlow: PropTypes.func,
};

Stages.displayName = 'Stages';

export default Stages;
