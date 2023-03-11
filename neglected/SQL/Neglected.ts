import { MakeFirstAfterNullable } from '@dius-workspace/server/types';
import { Dius } from '@dius-workspace/shared/types';

export const amazonNeglectedSql = ({
  first,
  after,
  details,
}: MakeFirstAfterNullable<Dius.QueryAmazonNeglectedProductsArgs>) => {
  let sql = `SELECT  p.id, p.sku, p.big_image, p.small_image,
                p.asin, nd.neglected_details, apd.neglected_status
                FROM products as p 
                LEFT JOIN LATERAL (
                  SELECT JSON_AGG(
                      JSON_BUILD_OBJECT(
                        'id', andd.id,
                        'date', TO_CHAR(andd.operation_date, 'mm/dd/yyyy'),
                        'operationMode', andd.operation_mode,
                        'note', andd.note
                      ) 
                  ) AS neglected_details
                  FROM amazon_neglected_details AS andd
                  WHERE andd.sku_id = p.id
                  GROUP BY sku_id
                ) AS nd
                ON true
                LEFT JOIN amazon_product_details AS apd
                ON apd.id = p.id 
                WHERE p.store_id = $1
                `;

  if (details.neglectedFilter) {
    sql += `AND apd.neglected_status = '${details.neglectedFilter}'
           `;
  }

  if (details.searchTerm) {
    sql += `AND (p.sku ILIKE '%${details.searchTerm}%')
            AND (apd.neglected_status  '%${details.searchTerm}%')
          `;
  }

  sql += `ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, p.id
         `;

  if (first !== null && after !== null) {
    sql += `OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY`;
  }

  return sql;
};

export const getMaxRowsOfSkuSql = `SELECT COUNT(sku_id) AS total_columns
                                    FROM amazon_neglected_details
                                    WHERE store_id = $1
                                    GROUP BY sku_id
                                    ORDER BY COUNT(sku_id) DESC
                                    LIMIT 1`;
