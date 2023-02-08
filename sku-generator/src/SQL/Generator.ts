import { BrandsInput } from '../controllers/Generator';

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

export const createBrandSql = `INSERT INTO brand(name, abbreviation)
                                VALUES($1,$2) RETURNING *`;

export const updateBrandSql = `UPDATE brand
                                SET name = $1,
                                    abbreviation = $2
                                WHERE id = $3
                                RETURNING *`;

export const deleteBrandSql = `DELETE FROM brand
                                WHERE id = $1`;

export const findSkuSql = `SELECT sku FROM (SELECT sku FROM products 
                            UNION ALL SELECT sku AS second_sku FROM generated_sku) 
                            AS prod WHERE LOWER(sku) = $1`;

export const addGeneratedSkuSql = `INSERT INTO generated_sku(sku)
                                    VALUES($1)`;
