import { ngql } from 'nr1';

const nrqlConditions = `nrqlConditions {
  guid: entityGuid
  name
  id
  policyId
}`;

const nrqlConditionsSearchQuery = (searchCriteria = '', countOnly) => ngql`
query($id: Int!) {
  actor {
    account(id: $id) {
      alerts {
        nrqlConditionsSearch(searchCriteria: {${searchCriteria}}) {
          ${countOnly ? 'totalCount' : nrqlConditions}
        }
      }
    }
  }
}`;

const latestStatusForAlertConditions = (conditionIds = []) =>
  `SELECT 
    latest(event) AS event, 
    latest(priority) AS priority, 
    latest(conditionName) as name 
  FROM NrAiIncident 
  FACET string(conditionId) 
  WHERE conditionId IN (${conditionIds.join(', ')})`.replace(/\s+/g, ' ');

const incidentsQuery = (whereClause, timeClause, limitStatement) =>
  `
  SELECT 
    account.id AS accountId, 
    conditionId, 
    priority, 
    event, 
    title, 
    incidentId, 
    openTime, 
    durationSeconds 
  FROM NrAiIncident 
  WHERE ${whereClause} AND closeTime IS NULL 
  ${timeClause} ${limitStatement}`.replace(/\s+/g, ' ');

export {
  nrqlConditionsSearchQuery,
  latestStatusForAlertConditions,
  incidentsQuery,
};
