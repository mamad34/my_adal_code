import {
  accessTokenFailedMessage,
  authenticateInventoryUser,
} from '@dius-workspace/server/authentication-functions';
import { pool } from '@dius-workspace/server/default-database-instance';
import { productImages } from '@dius-workspace/server/functions-shared';
import { ServerScreensNamesEnum } from '@dius-workspace/shared/screens-categories';
import { Dius } from '@dius-workspace/shared/types';
import { ACCESS_TOKEN } from '..';
import { amazonNeglectedSql, getMaxRowsOfSkuSql } from '../SQL/Neglected';

const neglectedResolver: Dius.Resolvers = {
  Query: {
    amazonNeglectedProducts: async (
      _parent,
      { first, after, details },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['MARKET_TRACKER']),
          access: 'VIEW',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const res = await pool.query<AmazonNeglectedQueryResult>(
          amazonNeglectedSql({ details, first: first + 1, after }),
          [user.shopId]
        );

        const totalColumnsRes = await pool.query<totalColumnsQueryResult>(
          getMaxRowsOfSkuSql,
          [user.shopId]
        );

        const hasNextPage = res.rowCount === first + 1;

        const neglectedResult: Dius.AmazonNeglectedProductsConnection = {
          edges: [],
          pageInfo: {
            hasNextPage,
            endCursor: first + after,
          },
          totalColumns: totalColumnsRes.rowCount
            ? totalColumnsRes.rows[0].total_columns &&
              totalColumnsRes.rows[0].total_columns > 5
              ? totalColumnsRes.rows[0].total_columns
              : 5
            : 5,
        };

        for (
          let i = 0;
          i < (hasNextPage ? res.rowCount - 1 : res.rowCount);
          i++
        ) {
          const item = res.rows[i];

          neglectedResult.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              sku: item.sku,
              asin: item.asin,
              image: productImages(item.small_image, item.big_image),
              neglectetStatus: item.neglected_status,
              neglectedDetails: item.neglected_details ?? [],
            },
          });
        }

        return neglectedResult;
      } catch (error) {
        console.log('amazonNeglectedProducts Err', error);
        throw new Error(error as string);
      }
    },
  },
};

export default neglectedResolver;

interface AmazonNeglectedQueryResult {
  id: string;
  sku: string;
  big_image: string | null;
  small_image: string | null;
  asin: string | null;
  neglected_details: Dius.AmazonNeglectedDetails[] | null;
  neglected_status: Dius.AmazonNeglectedStatus | null;
}

interface totalColumnsQueryResult {
  total_columns: number | null;
}
