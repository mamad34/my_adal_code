import { RelayInput } from '@dius-workspace/server/types';
import { BrandsInput, MamadCogsInput } from '../controllers/Generator';
import { BeforeLaunchBrandsInput } from '../controllers/Generator';
import { MamadPurchasesInput } from '../controllers/Generator';

export const getAllBrandsSql = (
  details: BrandsInput,
  first: number | null,
  after: number | null
) => {
  let sql = `SELECT * FROM brand `;

  if (details.searchTerm) {
    sql += ` WHERE (name ILIKE '%${details.searchTerm}%'
        OR abbreviation ILIKE '%${details.searchTerm}%') `;
  }

  sql += ` ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, id `;

  if (first !== null && after !== null) {
    sql += ` OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY `;
  }

  return sql;
};

export const getAllBeforeLaunchBrandsSql = (
  details: BeforeLaunchBrandsInput,
  first: number | null,
  after: number | null
) => {
  let sql = `                 SELECT bl.* , p.sku , p.asin , p.price 
                              FROM before_launch AS bl
                              LEFT JOIN products AS p
                              ON bl.sku_id = p.id `;

  if (details.searchTerm) {
    sql += `                   WHERE (p.sku ILIKE '%${details.searchTerm}%'
                               OR p.asin ILIKE '%${details.searchTerm}%') 
                               OR p.price ILIKE '%${details.searchTerm}%')
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

  sql += ` ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, bl.id `;

  if (first !== null && after !== null) {
    sql += `OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY `;
  }
  return sql;
};

export const getAllPurchasesSql = ({
  first,
  after,
  details,
}: RelayInput<MamadPurchasesInput, true>) => {
  let sql = `SELECT   pu.id, pu.sku,pr.small_image,pr.big_image,
                      TO_CHAR(date_time, 'mm/dd/yyyy') AS date,
                      pu.status,amount,TO_CHAR(etd, 'mm/dd/yyyy')AS etd,cp.price,cp.units,cp.price * units AS total_price,
                      invoice_number,vendor_name,vendor_emails,notes
                      FROM purchases AS pu 
                      LEFT JOIN products AS pr
                      ON pu.sku = pr.sku
                      LEFT JOIN china_purchase AS cp
                      ON cp.inventory_purchase_id = pu.id
                      WHERE pu.store_id = $1
                      `;

  if (details.searchTerm) {
    sql += `AND (pu.sku ILIKE '%${details.searchTerm}%'
             OR invoice_number  ILIKE '%${details.searchTerm}%'
             OR vendor_name    ILIKE '%${details.searchTerm}%')
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
  sql += ` ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, pu.id `;

  if (first !== null && after !== null) {
    sql += `OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY `;
  }
  return sql;
};

export const mamadGetAllCogsSql = ({
  first,
  after,
  details,
  dates,
}: RelayInput<MamadCogsInput, true, { dates: string[] }>) => {
  let sql = `WITH get_amount AS (
              SELECT sku,
              `;
  let sqlGetAmount = ``;
  let sqlGetCogs = ``;
  let gaAmount = ``;
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    sqlGetAmount += `SUM(CASE WHEN DATE(order_date) = '${date}' THEN amount END) AS amount_${
      i + 1
    } `;
    sqlGetCogs += `SUM(CASE WHEN created_on = '${date}' THEN ach.cogs END) AS cogs_${
      i + 1
    } `;
    gaAmount += `ga.amount_${i + 1}, gc.cogs_${i + 1} `;

    if (i !== dates.length - 1) {
      sqlGetAmount += `,
                      `;

      sqlGetCogs += `,
                    `;

      gaAmount += `,`;
    }
  }

  sql += sqlGetAmount;
  sql += `  FROM orders_summary AS os 
            WHERE os.store_id = $1
            GROUP BY sku
          ), 
          get_cogs AS (
            SELECT ach.sku_id,
            `;

  sql += sqlGetCogs;
  sql += `  FROM amazon_cogs_history AS ach 
            LEFT JOIN products AS p 
            ON p.id = ach.sku_id 
            WHERE p.store_id = $1			 
            GROUP BY ach.sku_id
          )
          SELECT p.id, p.sku,
          `;

  sql += gaAmount;

  sql += `
          FROM products AS p 
          LEFT JOIN get_amount AS ga
          ON ga.sku = p.sku 
          LEFT JOIN get_cogs AS gc 
          ON gc.sku_id = p.id
          WHERE p.store_id = $1;`;

  if (details.searchTerm) {
    sql += `AND (p.sku ILIKE '%${details.searchTerm}%')`;
  }

  details.filters.forEach((item) => {
    if (item.biggerThan !== null && item.lessThan !== null) {
      sql += `AND ${item.columnName} BETWEEN ${item.biggerThan} AND ${item.lessThan}`;
    } else if (item.biggerThan !== null) {
      sql += `AND ${item.columnName} >= ${item.biggerThan}`;
    } else {
      sql += `AND ${item.columnName} <= ${item.lessThan}`;
    }
  });
  sql += ` ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, p.id `;

  if (first !== null && after !== null) {
    sql += `OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY `;
  }
  return sql;
};

export const addWarehouseReceivingScheduleSql = `INSERT INTO warehouse_receiving_schedule (
                                                company_id,delivery_Date,delivery_time,
                                                shipment_invoice_number,container_number,time_in,
                                                time_out,notes,etd,eta,men,time_schedule_hour,
                                                time_schedule_minute,status,received,pre_received,
                                                archived,warehouse_id
                                              )
                                              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                                              $14,$15,$16,$17,$18) RETURNING id;`;

export const addWarehouseReceivingItemSql = `INSERT INTO warehouse_receiving_item (sku_id,number_of_units,
                                              number_of_boxes,sku_invoice_number,receiving_id,warehouse_id)
                                              VALUES ($1,$2,$3,$4,$5,$6) RETURNING id;`;

export const addWarehouseReceivingItemPalletSql = `INSERT INTO warehouse_receiving_item_pallet (receiving_item_id,number_of_units,
                                                    number_of_boxes,placement,warehouse_id)
                                                    VALUES ($1,$2,$3,$4,$5);`;

export const createBrandSql = `INSERT INTO brand(name, abbreviation)
                                VALUES($1,$2) RETURNING *`;

export const updateBrandSql = `UPDATE brand
                                SET name = $1,
                                abbreviation = $2
                                WHERE id = $3
                                RETURNING *`;

export const deleteBrandSql = `DELETE FROM brand
                               WHERE id = $1`;

export const findSkuSql = `   SELECT sku FROM (SELECT sku FROM products 
                              UNION ALL SELECT sku AS second_sku FROM generated_sku) 
                              AS prod WHERE LOWER(sku) = $1`;

export const addGeneratedSkuSql = `INSERT INTO generated_sku(sku)
                                   VALUES($1)`;

export const createBrandBeforeLaunchSql = `INSERT INTO before_launch 
                                          (sku_id , title_backend , title_backend_note ,
                                           pics_descriptive ,pics_descriptive_note)
                                           VALUES ($1 , $2 , $3 , $4 , $5 )  RETURNING *`;

export const updateBrandBeforeLaunchSql = ` UPDATE before_launch 
                                            (title_backend , title_backend_note ,
                                            pics_descriptive ,pics_descriptive_note,sku_id )
                                            SET title_backend = $1, title_backend_note = $2,
                                            pics_descriptive = $3,
                                            pics_descriptive_note = $4,
                                            sku_id = $5
                                            RETURNING *`;

export const getChinaAirTransferSql = `SELECT cat.id,
                                        cat.air_number,
                                        cat.air_freight_cost,
                                        cat.other_cost,
                                        TO_CHAR(cat.etd, 'mm/dd/yyyy') AS etd,
                                        cat.status
                                        FROM china_air_transfer AS cat
                                        WHERE cat.id = $1;`;

export const getChinaAirTransferSkuSql = `SELECT cats.id,
                                          p.sku,
                                          cats.sku_id,
                                          cats.units_per_box,
                                          cats.unit_price
                                          FROM china_air_transfer_sku AS cats
                                          JOIN china_air_transfer AS cat
                                          ON cats.air_transfer_id = cat.id
                                          LEFT JOIN products AS p 
                                          ON p.id = cats.sku_id
                                          WHERE cat.id = $1;
                                          `;

export const getChinaAirTrasferPurchaseSql = ` 
                                          SELECT catsi.id,catsi.purchase_id,catsi.units,catsi.note
                                          FROM china_air_transfer_sku_info AS catsi
                                          WHERE catsi.transfer_sku_id = $1;
                                          `;

export const getWarehouseReceivingScheduleSql = `SELECT wrs.id ,wc.name AS company_name,
                                                  TO_CHAR(wrs.delivery_date, 'mm/dd/yyyy') AS delivery_date,
                                                  wrs.status,wrs.pre_received,
                                                  wrs.received, wrs.notes,
                                                  TO_CHAR(wrs.etd, 'mm/dd/yyyy') AS etd
                                                  FROM warehouse_receiving_schedule AS wrs
                                                  JOIN warehouse_company AS wc
                                                  ON wrs.company_id = wc.id
                                                  WHERE wrs.id = $1;`;

export const getWarehouseReceivingItemSql = `SELECT  wri.id,
                                              p.sku,
                                              wri.sku_id,
                                              wri.number_of_boxes,
                                              wri.number_of_units,
                                              wri.sku_invoice_number
                                              FROM warehouse_receiving_item AS wri
                                              LEFT JOIN products AS p 
                                              ON p.id = wri.sku_id 
                                              WHERE wri.receiving_id = $1;`;

export const getWarehouseReceivingItemLocationSql = `SELECT wrip.id,
                                                      wrip.placement,
                                                      wrip.number_of_boxes
                                                      FROM warehouse_receiving_item_pallet AS wrip
                                                      WHERE wrip.receiving_item_id = $1;`;

export const getMamadFbaFeeConflictsSql = `WITH conflicts AS (
                                                SELECT sku_id ,
                                                MAX(CASE
                                                WHEN rn = 1 THEN old_fba_fee
                                                END) AS old_fba_change_1,
                                                MAX(CASE
                                                WHEN rn = 1 THEN new_fba_fee
                                                END) AS new_fba_change_1,
                                                MAX(CASE
                                                WHEN rn = 1 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_1
                                                ,
                                                MAX(CASE
                                                WHEN rn = 2 THEN old_fba_fee
                                                END) AS old_fba_change_2,
                                                MAX(CASE
                                                WHEN rn = 2 THEN new_fba_fee
                                                END) AS new_fba_change_2,
                                                MAX(CASE
                                                WHEN rn = 2 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_2
                                                ,
                                                MAX(CASE
                                                WHEN rn = 3 THEN old_fba_fee
                                                END) AS old_fba_change_3,
                                                MAX(CASE
                                                WHEN rn = 3 THEN new_fba_fee
                                                END) AS new_fba_change_3,
                                                MAX(CASE
                                                WHEN rn = 3 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_3
                                                ,
                                                MAX(CASE
                                                WHEN rn = 4 THEN old_fba_fee
                                                END) AS old_fba_change_4,
                                                MAX(CASE
                                                WHEN rn = 4 THEN new_fba_fee
                                                END) AS new_fba_change_4,
                                                MAX(CASE
                                                WHEN rn = 4 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_4
                                                ,
                                                MAX(CASE
                                                WHEN rn = 5 THEN old_fba_fee
                                                END) AS old_fba_change_5,
                                                MAX(CASE
                                                WHEN rn = 5 THEN new_fba_fee
                                                END) AS new_fba_change_5,
                                                MAX(CASE
                                                WHEN rn = 5 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_5
                                                ,
                                                MAX(CASE
                                                WHEN rn = 6 THEN old_fba_fee
                                                END) AS old_fba_change_6,
                                                MAX(CASE
                                                WHEN rn = 6 THEN new_fba_fee
                                                END) AS new_fba_change_6,
                                                MAX(CASE
                                                WHEN rn = 6 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_6
                                                ,
                                                MAX(CASE
                                                WHEN rn = 7 THEN old_fba_fee
                                                END) AS old_fba_change_7,
                                                MAX(CASE
                                                WHEN rn = 7 THEN new_fba_fee
                                                END) AS new_fba_change_7,
                                                MAX(CASE
                                                WHEN rn = 7 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_7
                                                ,
                                                MAX(CASE
                                                WHEN rn = 8 THEN old_fba_fee
                                                END) AS old_fba_change_8,
                                                MAX(CASE
                                                WHEN rn = 8 THEN new_fba_fee
                                                END) AS new_fba_change_8,
                                                MAX(CASE
                                                WHEN rn = 8 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_8
                                                ,
                                                MAX(CASE
                                                WHEN rn = 9 THEN old_fba_fee
                                                END) AS old_fba_change_9,
                                                MAX(CASE
                                                WHEN rn = 9 THEN new_fba_fee
                                                END) AS new_fba_change_9,
                                                MAX(CASE
                                                WHEN rn = 9 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_9
                                                ,
                                                MAX(CASE
                                                WHEN rn = 10 THEN old_fba_fee
                                                END) AS old_fba_change_10,
                                                MAX(CASE
                                                WHEN rn = 10 THEN new_fba_fee
                                                END) AS new_fba_change_10,
                                                MAX(CASE
                                                WHEN rn = 10 THEN TO_CHAR(change_date,'mm/dd/yyyy')
                                                END) AS date_change_10
                                                FROM (
                                                SELECT *, row_number() OVER(PARTITION BY sku_id ORDER BY change_date DESC) AS rn
                                                FROM fba_fee_change_log AS ffcl
                                                ORDER BY sku_id
                                                ) AS temp
                                                WHERE rn <= 10
                                                GROUP BY sku_id
                                                )
                                                SELECT TO_CHAR(ffc.case_date,'mm/dd/yyyy'),c.*, p.sku ,p.id,p.fba_fee, p.big_image ,
                                                p.small_image , p.unit_weight, p.unit_length, p.unit_width, p.unit_height,p.is_small_and_light,
                                                package_height,package_length,package_width,package_weight
                                                FROM conflicts AS c
                                                LEFT JOIN products AS p
                                                ON p.id = c.sku_id
                                                LEFT JOIN fba_fee_conflicts AS ffc 
                                                ON p.id = ffc.sku_id`;
