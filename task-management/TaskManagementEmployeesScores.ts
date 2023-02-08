import {
  accessTokenFailedMessage,
  authenticateInventoryUser,
} from '@dius-workspace/server/authentication-functions';
import {
  FilterInput,
  RelayInput,
  RelayStyle,
  SortInput,
} from '@dius-workspace/server/types';
import { ServerScreensNamesEnum } from '@dius-workspace/shared/screens-categories';
import { IResolvers } from '@graphql-tools/utils';
import { ACCESS_TOKEN } from '..';
import { pool } from '../services/pg';
import {
  TaskManagementEmployeeScoresSql,
  TaskManagementEmployeesScoresSql,
} from '../SQL/TaskManagementEmployeesScores';

const taskManagementEmployeesScoresResolver: IResolvers = {
  TaskManagementEmployeesScoresSortableColumns: {
    NAME: 'au.name',
    SCORE: 'SUM(tmus.score)',
  },
  TaskManagementEmployeesScoresFilterableColumns: {
    SCORE: 'SUM(tmus.score)',
  },

  TaskManagementEmployeeScoresFilterInput: {
    SCORE: 'tmus.score',
  },
  TaskManagementEmployeeScoresSortableColumns: {
    SCORE: 'tmus.score',
    FINISHED_ON: 'tmus.finished_on',
    ACTIVATED_ON: 'tmus.activated_on',
    DUE_DATE: 'tmus.due_date',
  },
  Query: {
    taskManagementEmployeeScores: async (
      _parent,
      { first, after, details }: RelayInput<TaskManagementEmployeeScoresInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>([
            'TASK_MANAGEMENT_EMPLOYEES_SCORES',
          ]),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const res = await pool.query<TaskManagementEmployeeScoresQueryResult>(
          TaskManagementEmployeeScoresSql({
            first: first + 1,
            after,
            details,
          }),
          [user.shopId]
        );

        const hasNextPage = res.rowCount === first + 1;

        const result: TaskManagementEmployeeScoresResult = {
          edges: [],
          pageInfo: {
            endCursor: first + after,
            hasNextPage: hasNextPage,
          },
        };
        for (
          let i = 0;
          i < (hasNextPage ? res.rowCount - 1 : res.rowCount);
          i++
        ) {
          const item = res.rows[i];
          result.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              description: item.description,
              dueDate: item.dueDate,
              activatedOn: item.activatedOn,
              finishedOn: item.finishedOn,
              score: item.score,
            },
          });
        }
        return result;
      } catch (error: any) {
        console.log('taskManagementEmployeeScores err', error);
        throw new Error(error);
      }
    },
    taskManagementEmployeesScores: async (
      _parent,
      { first, after, details }: RelayInput<TaskManagementEmployeesScoresInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>([
            'TASK_MANAGEMENT_EMPLOYEES_SCORES',
          ]),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const res = await pool.query<TaskManagementEmployeesScoresQueryResult>(
          TaskManagementEmployeesScoresSql({
            first: first + 1,
            after,
            details,
          })
        );

        const hasNextPage = res.rowCount === first + 1;

        const result: TaskManagementEmployeesScoresResult = {
          edges: [],
          pageInfo: {
            endCursor: first + after,
            hasNextPage: hasNextPage,
          },
        };

        for (
          let i = 0;
          i < (hasNextPage ? res.rowCount - 1 : res.rowCount);
          i++
        ) {
          const item = res.rows[i];

          result.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              name: item.name,
              score: item.score ?? 0,
            },
          });
        }

        return result;
      } catch (error: any) {
        console.log('taskManagementEmployeesScores err', error);
        throw new Error(error);
      }
    },
  },
};

export default taskManagementEmployeesScoresResolver;

type TaskManagementEmployeesScoresFilterableColumns = 'SCORE';

type TaskManagementEmployeesScoresSortableColumns = 'NAME' | 'SCORE';

type TaskManagementEmployeeScoresFilterInput = 'SCORE';

type TaskManagementEmployeeScoresSortableColumns =
  | 'SCORE'
  | 'FINISHED_ON'
  | 'ACTIVATED_ON'
  | 'DUE_DATE';

type TaskManagementEmployeesScoresResult =
  RelayStyle<TaskManagementEmployeesScoresNode>;

type TaskManagementEmployeeScoresResult =
  RelayStyle<TaskManagementEmployeeScoresNode>;
export interface TaskManagementEmployeesScoresInput {
  searchTerm: string;
  fromDate: string | null;
  toDate: string | null;
  sort: SortInput<TaskManagementEmployeesScoresSortableColumns>;
  filters: FilterInput<TaskManagementEmployeesScoresFilterableColumns>[];
}

interface TaskManagementEmployeesScoresNode {
  id: string;
  name: string;
  score: number;
}

interface TaskManagementEmployeesScoresQueryResult {
  id: string;
  name: string;
  score: number | null;
}
interface TaskManagementEmployeeScoresNode {
  id: string;
  score: number;
  description: string;
  finishedOn: string;
  activatedOn: string;
  dueDate: string;
}

export interface TaskManagementEmployeeScoresInput {
  searchTerm: string;
  fromDate: string;
  toDate: string;
  score: number;
  sort: SortInput<TaskManagementEmployeeScoresSortableColumns>;
  filters: FilterInput<TaskManagementEmployeeScoresFilterInput>[];
}

interface TaskManagementEmployeeScoresQueryResult {
  id: string;
  description: string;
  score: number;
  finishedOn: string;
  activatedOn: string;
  dueDate: string;
}
