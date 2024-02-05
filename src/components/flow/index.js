import React, {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';
import PropTypes from 'prop-types';

import { AccountStorageMutation, Spinner } from 'nr1';

import { KpiBar, Stages, DeleteConfirmModal, EditFlowSettingsModal } from '../';
import FlowHeader from './header';
import { MODES, NERD_STORAGE } from '../../constants';
import { useFlowWriter } from '../../hooks';
import { AppContext, FlowContext, FlowDispatchContext } from '../../contexts';
import {
  FLOW_DISPATCH_COMPONENTS,
  FLOW_DISPATCH_TYPES,
  flowReducer,
} from '../../reducers';

const Flow = forwardRef(
  (
    {
      flowDoc = {},
      onClose,
      mode = MODES.INLINE,
      prevNonEditMode,
      setMode = () => null,
      flows = [],
      onSelectFlow = () => null,
      onTransition,
      editFlowSettings = false,
      setEditFlowSettings = () => null,
    },
    ref
  ) => {
    const [flow, dispatch] = useReducer(flowReducer, {});
    const [isDeletingFlow, setIsDeletingFlow] = useState(false);
    const [deleteModalHidden, setDeleteModalHidden] = useState(true);
    const [lastSavedTimestamp, setLastSavedTimestamp] = useState();
    const [isPreview, setIsPreview] = useState(false);
    const { account: { id: accountId } = {}, user } = useContext(AppContext);
    const flowWriter = useFlowWriter({ accountId, user });

    useEffect(
      () =>
        dispatch({
          type: FLOW_DISPATCH_TYPES.CHANGED,
          component: FLOW_DISPATCH_COMPONENTS.FLOW,
          updates: flowDoc,
        }),
      [flowDoc]
    );

    useEffect(() => {
      if (isPreview) setMode(prevNonEditMode);
    }, [isPreview]);

    const saveFlow = useCallback(async (document) => {
      setLastSavedTimestamp(0);
      const documentId = document.id;
      await flowWriter.write({ documentId, document });
    }, []);

    const flowUpdateHandler = (updates = {}) =>
      dispatch({
        type: FLOW_DISPATCH_TYPES.UPDATED,
        component: FLOW_DISPATCH_COMPONENTS.FLOW,
        updates,
      });

    const persistFlowHandler = () => {
      dispatch({
        type: FLOW_DISPATCH_TYPES.PERSISTED,
        component: FLOW_DISPATCH_COMPONENTS.FLOW,
        saveFlow,
      });
      if (onTransition && prevNonEditMode) onTransition(prevNonEditMode);
    };

    const discardFlowHandler = useCallback(() => {
      setIsPreview(false);
      if (onTransition) onTransition(prevNonEditMode);
    }, [prevNonEditMode]);

    useEffect(() => {
      const { nerdStorageWriteDocument: document } = flowWriter?.data || {};
      if (document) setLastSavedTimestamp(Date.now());
    }, [flowWriter.data]);

    const updateKpisHandler = (updatedKpis) =>
      flowUpdateHandler({ kpis: updatedKpis });

    const deleteFlowHandler = useCallback(async () => {
      setIsDeletingFlow(true);
      const {
        data: { nerdStorageDeleteDocument: { deleted } = {} } = {},
        error,
      } = await AccountStorageMutation.mutate({
        actionType: AccountStorageMutation.ACTION_TYPE.DELETE_DOCUMENT,
        collection: NERD_STORAGE.FLOWS_COLLECTION,
        accountId,
        documentId: flow.id,
      });
      setIsDeletingFlow(false);
      if (error) console.error('Error deleting flow', error);
      if (deleted) onClose();
    }, [flow]);

    const togglePreview = () => {
      if (isPreview && mode !== MODES.EDIT) setMode(MODES.EDIT);
      setIsPreview((p) => !p);
    };

    return (
      <FlowContext.Provider value={flow}>
        <FlowDispatchContext.Provider value={dispatch}>
          <div className="flow" ref={ref}>
            {flow?.id && (
              <>
                <DeleteConfirmModal
                  name={flow.name}
                  type="flow"
                  hidden={deleteModalHidden}
                  onConfirm={deleteFlowHandler}
                  onClose={() => setDeleteModalHidden(true)}
                  isDeletingFlow={isDeletingFlow}
                />
                {editFlowSettings && (
                  <EditFlowSettingsModal
                    onUpdate={flowUpdateHandler}
                    onDeleteFlow={() => setDeleteModalHidden(false)}
                    editFlowSettings={editFlowSettings}
                    setEditFlowSettings={setEditFlowSettings}
                  />
                )}
              </>
            )}
            {!isDeletingFlow ? (
              <>
                <FlowHeader
                  name={flow.name}
                  imageUrl={flow.imageUrl}
                  isPreview={isPreview}
                  onPreview={togglePreview}
                  onUpdate={flowUpdateHandler}
                  onDiscard={discardFlowHandler}
                  onPersist={persistFlowHandler}
                  onClose={onClose}
                  mode={mode}
                  setMode={setMode}
                  flows={flows}
                  onSelectFlow={onSelectFlow}
                  onDeleteFlow={() => setDeleteModalHidden(false)}
                  lastSavedTimestamp={lastSavedTimestamp}
                  resetLastSavedTimestamp={() => setLastSavedTimestamp(0)}
                  editFlowSettings={editFlowSettings}
                  setEditFlowSettings={setEditFlowSettings}
                />
                <Stages mode={mode} />
                <KpiBar onChange={updateKpisHandler} mode={mode} />
              </>
            ) : (
              <Spinner />
            )}
          </div>
        </FlowDispatchContext.Provider>
      </FlowContext.Provider>
    );
  }
);

Flow.propTypes = {
  flowDoc: PropTypes.object,
  onClose: PropTypes.func,
  mode: PropTypes.oneOf(Object.values(MODES)),
  prevNonEditMode: PropTypes.oneOf(Object.values(MODES)),
  setMode: PropTypes.func,
  flows: PropTypes.array,
  onTransition: PropTypes.func,
  onSelectFlow: PropTypes.func,
  editFlowSettings: PropTypes.bool,
  setEditFlowSettings: PropTypes.func,
};

Flow.displayName = 'Flow';

export default Flow;
