import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  NerdGraphQuery,
  navigation,
  nerdlet,
  useNerdletState,
  usePlatformState,
} from 'nr1';

import Listing from './listing';
import Header from './header';
import TabBar from './tab-bar';
import Filters from './filters';
import Footer from './footer';
import useFetchSignals from './use-fetch-signals';
import useEntitiesTypesList from './use-entities-types-list';
import { useFetchUser, useFlowLoader, useFlowWriter } from '../../src/hooks';
import { queryFromGuidsArray } from '../../src/queries';
import { entitiesDetailsFromQueryResults } from '../../src/utils';
import { MODES, SIGNAL_TYPES, UI_CONTENT } from '../../src/constants';

const MAX_GUIDS_PER_CALL = 25;

const guidsArray = (entities = [], maxArrayLen) =>
  entities.reduce(
    (acc, { guid } = {}, i) => {
      if (!guid) return acc;
      const insertAtIdx = Math.floor(i / maxArrayLen);
      acc[insertAtIdx].push(guid);
      return acc;
    },
    Array.from({ length: Math.ceil(entities.length / maxArrayLen) }, () => [])
  );

const uniqueGuidsArray = (arr = [], item = {}, shouldRemove) => {
  const idx = arr.findIndex(({ guid }) => guid === item.guid);
  if (shouldRemove)
    return idx < 0 ? [...arr] : [...arr.slice(0, idx), ...arr.slice(idx + 1)];
  return idx < 0 ? [...arr, item] : [...arr];
};

const nameFilter = (items, searchText) =>
  items.filter(({ name = '' }) =>
    name.toLocaleLowerCase().includes(searchText.toLocaleLowerCase())
  );

const SignalSelectionNerdlet = () => {
  const [currentTab, setCurrentTab] = useState(SIGNAL_TYPES.ENTITY);
  const [acctId, setAcctId] = useState();
  const [selectedEntityType, setSelectedEntityType] = useState();
  const [entities, setEntities] = useState([]);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [filteredEntities, setFilteredEntities] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [signalsDetails, setSignalsDetails] = useState({});
  const [fetchEntitiesNextCursor, setFetchEntitiesNextCursor] = useState();
  const [searchText, setSearchText] = useState('');
  const [lazyLoadingProps, setLazyLoadingProps] = useState({});
  const [{ accountId }] = usePlatformState();
  const [
    { flowId, levelId, levelOrder, stageId, stageName, stepId, stepTitle },
  ] = useNerdletState();
  const { entitiesCount, entitiesTypesList } = useEntitiesTypesList();
  const { user } = useFetchUser();
  const { flows: flow } = useFlowLoader({ accountId, flowId });
  const flowWriter = useFlowWriter({ accountId, user });
  const { fetchEntities, fetchAlerts } = useFetchSignals();

  useEffect(() => {
    nerdlet.setConfig({
      timePicker: false,
    });
  }, []);

  useEffect(() => setAcctId(accountId), [accountId]);

  useEffect(() => {
    if (!flow) return;

    const fetchSignalsDetails = async (arrayOfGuids) => {
      const query = queryFromGuidsArray(arrayOfGuids);
      const { data: { actor = {} } = {} } = await NerdGraphQuery.query({
        query,
      });
      setSignalsDetails(entitiesDetailsFromQueryResults(actor));
    };
    const { levels = [] } =
      (flow?.stages || []).find(({ id }) => id === stageId) || {};
    const { steps = [] } = levels.find(({ id }) => id === levelId) || {};
    const step = steps.find(({ id }) => id === stepId) || {};
    const [existingEntities, existingAlerts] = (step?.signals || []).reduce(
      (acc, signal) => {
        if (signal?.type === SIGNAL_TYPES.ENTITY) {
          acc[0].push(signal);
        } else if (signal?.type === SIGNAL_TYPES.ALERT) {
          acc[1].push(signal);
        }
        return acc;
      },
      [[], []]
    );
    const arrayOfGuids = guidsArray(
      [...existingEntities, ...existingAlerts],
      MAX_GUIDS_PER_CALL
    );
    if (arrayOfGuids.length) fetchSignalsDetails(arrayOfGuids);

    if (existingEntities.length)
      setSelectedEntities((se) => [...se, ...existingEntities]);
    if (existingAlerts.length)
      setSelectedAlerts((sa) => [...sa, ...existingAlerts]);
  }, [flow]);

  useEffect(() => {
    const getAlertsCount = async (id, searchQuery, countOnly) => {
      const { data } = await fetchAlerts({ id, searchQuery, countOnly });
      setAlertCount(data?.totalCount || 0);
    };

    if (acctId) getAlertsCount(acctId, '', true).catch(console.error);
  }, [acctId, fetchAlerts]);

  useEffect(() => {
    const getEntities = async () => {
      const { data: { entities: e = [], nextCursor } = {} } =
        await fetchEntities({
          entityDomainType: selectedEntityType,
        });
      setEntities(() => (e && e.length ? e : []));
      setFetchEntitiesNextCursor(nextCursor);
    };

    const getAlerts = async (id, searchQuery) => {
      const { data: { nrqlConditions = [] } = {} } = await fetchAlerts({
        id,
        searchQuery,
      });
      setAlerts(() =>
        nrqlConditions && nrqlConditions.length ? nrqlConditions : []
      );
    };

    if (currentTab === SIGNAL_TYPES.ENTITY) {
      if (entitiesCount && selectedEntityType) {
        getEntities().catch(console.error);
      } else {
        setEntities(() => []);
      }
    } else if (currentTab === SIGNAL_TYPES.ALERT) {
      if (acctId && alertCount && alertCount <= 200) {
        getAlerts(acctId).catch(console.error);
      } else {
        setAlerts(() => []);
      }
    }
  }, [
    currentTab,
    acctId,
    selectedEntityType,
    fetchEntities,
    alertCount,
    fetchAlerts,
  ]);

  useEffect(
    () =>
      setSelectedEntityType((et) =>
        entitiesTypesList?.length ? entitiesTypesList[0] : et
      ),
    [entitiesTypesList]
  );

  useEffect(() => {
    if (searchText) {
      setFilteredAlerts(nameFilter(alerts, searchText));
      setFilteredEntities(nameFilter(entities, searchText));
      setLazyLoadingProps({});
    } else {
      setFilteredAlerts(alerts);
      setFilteredEntities(entities);
      setLazyLoadingProps({
        rowCount: selectedEntityType?.count,
        onLoadMore,
      });
    }
  }, [
    currentTab,
    alerts,
    entities,
    searchText,
    selectedEntityType,
    onLoadMore,
  ]);

  const onLoadMore = useCallback(async () => {
    const { data: { entities: e = [], nextCursor } = {} } = await fetchEntities(
      {
        entityDomainType: selectedEntityType,
        cursor: fetchEntitiesNextCursor,
      }
    );
    setEntities((ent) => (e && e.length ? [...ent, ...e] : ent));
    setFetchEntitiesNextCursor(nextCursor);
  }, [fetchEntities, selectedEntityType, fetchEntitiesNextCursor]);

  const accountChangeHandler = useCallback((ai) => setAcctId(ai), []);

  const entityTypeChangeHandler = useCallback(
    (e) => setSelectedEntityType(e),
    []
  );

  const entityTypeTitle = useMemo(
    () =>
      selectedEntityType
        ? selectedEntityType.displayName ||
          `${selectedEntityType.domain}/${selectedEntityType.type}`
        : UI_CONTENT.SIGNAL_SELECTION.ENTITY_TYPE_DROPDOWN_PLACEHOLDER,
    [selectedEntityType]
  );

  const selectItemHandler = useCallback((type, checked, item) => {
    if (type === SIGNAL_TYPES.ENTITY)
      setSelectedEntities((se) => uniqueGuidsArray(se, item, !checked));
    if (type === SIGNAL_TYPES.ALERT)
      setSelectedAlerts((sa) => uniqueGuidsArray(sa, item, !checked));
  }, []);

  const deleteItemHandler = useCallback(
    (type, guid) => selectItemHandler(type, false, { guid }),
    [selectItemHandler]
  );

  const cancelHandler = useCallback(() => navigation.closeNerdlet(), []);

  const saveHandler = useCallback(async () => {
    if (!flow) return;

    const stageIndex = (flow.stages || []).findIndex(
      ({ id }) => id === stageId
    );
    if (stageIndex < 0) return;
    const levelIndex = (flow.stages[stageIndex].levels || []).findIndex(
      ({ id }) => id === levelId
    );
    if (levelIndex < 0) return;
    const stepIndex = (
      flow.stages[stageIndex].levels[levelIndex].steps || []
    ).findIndex(({ id }) => id === stepId);
    if (stepIndex < 0) return;

    const document = { ...flow };
    document.stages[stageIndex].levels[levelIndex].steps[stepIndex].signals = [
      ...(selectedEntities || []).map(({ guid, name }) => ({
        guid,
        name,
        type: SIGNAL_TYPES.ENTITY,
      })),
      ...(selectedAlerts || []).map(({ guid, name }) => ({
        guid,
        name,
        type: SIGNAL_TYPES.ALERT,
      })),
    ];

    await flowWriter.write({ documentId: flowId, document });
    navigation.openNerdlet({
      id: 'home',
      urlState: {
        flow: { id: flowId },
        mode: MODES.EDIT,
        refreshFlows: true,
      },
    });
  }, [flow, stageId, levelId, stepId, selectedEntities, selectedAlerts]);

  return (
    <div className="container nerdlet">
      <div className="signal-select">
        <Header
          stageName={stageName}
          levelOrder={levelOrder}
          stepTitle={stepTitle}
        />
        <TabBar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          labels={{
            [SIGNAL_TYPES.ENTITY]: `Entities (${entitiesCount})`,
            [SIGNAL_TYPES.ALERT]: `Alerts (${alertCount})`,
          }}
        />
        <Filters
          currentTab={currentTab}
          accountId={acctId}
          entityTypeTitle={entityTypeTitle}
          entityTypes={entitiesTypesList}
          onAccountChange={accountChangeHandler}
          onEntityTypeChange={entityTypeChangeHandler}
          searchText={searchText}
          setSearchText={setSearchText}
        />
        <Listing
          currentTab={currentTab}
          entities={filteredEntities}
          alerts={filteredAlerts}
          selectedEntities={selectedEntities}
          selectedAlerts={selectedAlerts}
          signalsDetails={signalsDetails}
          onSelect={selectItemHandler}
          onDelete={deleteItemHandler}
          {...lazyLoadingProps}
        />
        <Footer
          noFlow={!flow}
          entitiesCount={selectedEntities.length}
          alertsCount={selectedAlerts.length}
          saveHandler={saveHandler}
          cancelHandler={cancelHandler}
        />
      </div>
    </div>
  );
};

export default SignalSelectionNerdlet;
