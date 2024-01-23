import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AccountStorageMutation,
  HeadingText,
  navigation,
  nerdlet,
  useAccountsQuery,
  usePlatformState,
} from 'nr1';

import { useFetchUser } from '../../src/hooks';

import StartPage from './start';
import BlankFlow from './blank';
import { uuid } from '../../src/utils';
import { NERD_STORAGE, UI_CONTENT } from '../../src/constants';

const CreateFlowNerdlet = () => {
  const [page, setPage] = useState('start');
  const [{ accountId }, setPlatformUrlState] = usePlatformState();
  const { user } = useFetchUser();
  const { data: accounts = [] } = useAccountsQuery();

  useEffect(() => {
    nerdlet.setConfig({
      timePicker: false,
    });
  }, []);

  const createHandler = useCallback(
    async (acctId, doc = {}) => {
      if (!acctId) return;
      const id = uuid();
      const document = {
        ...doc,
        id,
        created: {
          user,
          timestamp: Date.now(),
        },
      };
      const {
        data: { nerdStorageWriteDocument: { id: writeId } = {} } = {},
        error,
      } = await AccountStorageMutation.mutate({
        accountId: acctId,
        actionType: AccountStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
        collection: NERD_STORAGE.FLOWS_COLLECTION,
        documentId: id,
        document,
      });
      if (error) console.error('Error creating flow', error);
      if (writeId === id) {
        setPlatformUrlState({ filters: UI_CONTENT.DUMMY_FILTER });
        navigation.closeNerdlet();
      }
    },
    [user]
  );

  const cancelHandler = () => setPage('start');

  const content = useMemo(() => {
    if (!page || page === 'start') return <StartPage onSelect={setPage} />;
    if (page === 'blank')
      return (
        <BlankFlow
          accountId={accountId}
          accounts={accounts}
          onCreate={createHandler}
          onCancel={cancelHandler}
        />
      );
    return null;
  }, [page]);

  return (
    <div className="container nerdlet">
      <div className="create-flow">
        <header>
          <HeadingText type={HeadingText.TYPE.HEADING_2}>
            Create Flow
          </HeadingText>
        </header>
        {content}
      </div>
    </div>
  );
};

export default CreateFlowNerdlet;