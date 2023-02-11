import { RelayInput } from '@dius-workspace/server/types';
import { InventoryChinaSupplierDropboxLinksInput } from '../controllers/ChinaSupplierDropbox';

export const inventoryChinaSupplierDropboxLinksSql = ({
  first,
  after,
  details,
}: RelayInput<InventoryChinaSupplierDropboxLinksInput>) => {
  let sql = `SELECT csw.id, cs.name, cswdl.ci_pl_link, cswdl.pi_link
              FROM china_supplier_warehouse AS csw
              JOIN china_supplier AS cs
              ON cs.id = csw.supplier_id
              LEFT JOIN china_supplier_warehouse_dropbox_link AS cswdl
              ON cswdl.id = csw.id
              WHERE csw.store_id = $1
              `;

  if (details.searchTerm) {
    sql += `AND (cs.name ILIKE '%${details.searchTerm}%')
           `;
  }

  sql += `ORDER BY ${details.sort.columnName} ${details.sort.sortBy} NULLS LAST, csw.id
          `;

  if (first !== null && after !== null) {
    sql += `OFFSET ${after} ROWS FETCH FIRST ${first} ROWS ONLY`;
  }

  return sql;
};

export const addOrEditInventoryChinaSupplierDropboxLinksSql = `INSERT INTO china_supplier_warehouse_dropbox_link(id,ci_pl_link,
                                                                pi_link)
                                                                VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE
                                                                SET ci_pl_link = EXCLUDED.ci_pl_link,
                                                                pi_link = EXCLUDED.pi_link
                                                                RETURNING id;`

export const getInventoryChinaSupplierDropboxLinksSql = `SELECT csw.id, cs.name, cswdl.ci_pl_link, cswdl.pi_link
                                                          FROM china_supplier_warehouse AS csw
                                                          JOIN china_supplier AS cs
                                                          ON cs.id = csw.supplier_id
                                                          LEFT JOIN china_supplier_warehouse_dropbox_link AS cswdl
                                                          ON cswdl.id = csw.id
                                                          WHERE csw.id = $1;`;
