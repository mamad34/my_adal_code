import {
  TaskManagementEmployeeScoresInput,
  TaskManagementEmployeesScoresInput,
} from '../controllers/TaskManagementEmployeesScores';
import { RelayInput } from '@dius-workspace/server/types';

export const TaskManagementEmployeeScoresSql = ({
  first,
  after,
  details,
}: RelayInput<TaskManagementEmployeeScoresInput>) => {
  let sql = `SELECT tmus.id, tmus.description, TO_CHAR(tmus.activated_on AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.000"Z"'), 
                TO_CHAR(tmus.finished_on AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"'), tmus.due_date, tmus.score
                FROM task_management_user_score AS tmus
                WHERE user_id = $1
                `;
  if (details.fromDate && details.toDate) {
    sql += `AND tmus.date_time BETWEEN '${details.fromDate}' AND '${details.toDate}'
           `;
  } else if (details.fromDate) {
    sql += `AND tmus.date_time >= '${details.fromDate}'
           `;
  } else {
    sql += `AND tmus.date_time <= '${details.toDate}'
           `;
  }
  if (details.searchTerm) {
    sql += `AND (tmus.description ILIKE '%${details.searchTerm}%')
           `;
  }
  details.filters.forEach((item) => {
    if (item.biggerThan !== null && item.lessThan !== null) {
      sql += `AND ${item.columnName} BETWEEN ${item.biggerThan} AND ${item.lessThan}
             `;
    } else if (item.biggerThan !== null) {
      sql += `AND ${item.columnName} >= ${item.biggerThan}
             `;
    } else {
      sql += `AND ${item.columnName} <= ${item.lessThan}
             `;
    }
  });

  sql += `ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, au.id
          `;

  if (first !== null && after !== null) {
    sql += `OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY`;
  }

  return sql;
};

export const TaskManagementEmployeesScoresSql = ({
  first,
  after,
  details,
}: RelayInput<TaskManagementEmployeesScoresInput>) => {
  let sql = `SELECT au.id, au.name, SUM(tmus.score) AS score
              FROM amazon_user AS au
              LEFT JOIN task_management_user_score AS tmus
              ON au.id = tmus.user_id
              `;

  if (details.fromDate && details.toDate) {
    sql += `AND tmus.date_time BETWEEN '${details.fromDate}' AND '${details.toDate}'
            `;
  } else if (details.fromDate) {
    sql += `AND tmus.date_time >= '${details.fromDate}'
            `;
  } else {
    sql += `AND tmus.date_time <= '${details.toDate}'
            `;
  }

  sql += `WHERE au.deleted = false
          `;

  if (details.searchTerm) {
    sql += `AND (au.name ILIKE '%${details.searchTerm}%')
            `;
  }

  details.filters.forEach((item) => {
    if (item.biggerThan !== null && item.lessThan !== null) {
      sql += `AND ${item.columnName} BETWEEN ${item.biggerThan} AND ${item.lessThan}
              `;
    } else if (item.biggerThan !== null) {
      sql += `AND ${item.columnName} >= ${item.biggerThan}
              `;
    } else {
      sql += `AND ${item.columnName} <= ${item.lessThan}
              `;
    }
  });

  sql += `GROUP BY au.id, au.name
          ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, au.id
          `;

  if (first !== null && after !== null) {
    sql += `OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY`;
  }

  return sql;
};
