import {
  accessTokenFailedMessage,
  authenticateInventoryUser,
} from '@dius-workspace/server/authentication-functions';
import { getLACurrentDateTime } from '@dius-workspace/server/functions-shared';
import type {
  RelayInput,
  RelayStyle,
  SortInput,
} from '@dius-workspace/server/types';
import { ServerScreensNamesEnum } from '@dius-workspace/shared/screens-categories';
import { IResolvers } from '@graphql-tools/utils';
import { ACCESS_TOKEN } from '..';
import { pool } from '../services/pg';
import {
  addGeneratedSkuSql,
  createBrandSql,
  deleteBrandSql,
  findSkuSql,
  getAllBrandsSql,
  updateBrandSql,
} from '../SQL/Generator';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const generator: IResolvers = {
  Query: {
    brands: async (
      _parent,
      { first, after, details }: RelayInput<BrandsInput, true>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
          access: 'VIEW',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const res = await pool.query<BrandsQueryResult>(
          getAllBrandsSql(details, first ? first + 1 : null, after)
        );

        const hasNextPage = first ? res.rowCount === first + 1 : false;

        const brands: BrandsResult = {
          edges: [],
          pageInfo: {
            hasNextPage,
            endCursor: first !== null && after !== null ? first + after : 0,
          },
        };

        for (
          let i = 0;
          i < (hasNextPage ? res.rowCount - 1 : res.rowCount);
          i++
        ) {
          const item = res.rows[i];

          brands.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              name: item.name,
              abbreviation: item.abbreviation,
            },
          });
        }

        return brands;
      } catch (error: any) {
        console.log('getAllBrands err ', error);
        throw new Error(error);
      }
    },
  },
  Mutation: {
    createBrand: async (_parent, { details }, { auth }, _info) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
          access: 'EDIT',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const brand = await pool.query<BrandsQueryResult>(createBrandSql, [
          details.name,
          details.abbreviation,
        ]);

        return brand.rows[0];
      } catch (error: any) {
        console.log('createBrand err', error);
        if (error.code === '23505') {
          throw new Error("Can't add two brands with same abbreviation");
        }
        throw new Error(error);
      }
    },
    editBrand: async (
      _parent,
      { details }: { details: BrandsQueryResult },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
          access: 'EDIT',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const brand = await pool.query<BrandsQueryResult>(updateBrandSql, [
          details.name,
          details.abbreviation,
          details.id,
        ]);

        return brand.rows[0];
      } catch (error: any) {
        console.log('editBrand err ', error);
        if (error.code === '23505') {
          throw new Error('Abbreviation already exists');
        }
        throw new Error(error);
      }
    },
    deleteBrand: async (_parent, { id }, { auth }, _info) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
          access: 'EDIT',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        await pool.query(deleteBrandSql, [id]);

        return true;
      } catch (error: any) {
        console.log('deleteBrand err', error);
        throw new Error(error);
      }
    },
    generateSku: async (
      _parent,
      { details }: { details: GenerateSkuInput },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['SKU_GENERATOR']),
          access: 'EDIT',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        let name = details.productName.replace(/[^a-zA-Z ]/g, '');
        name = name.replace(/ /g, '');

        let generatedSku = '';
        let finished = false;
        while (!finished || generatedSku.length === 0) {
          generatedSku = '';

          for (let i = 0; i < 4; i++) {
            generatedSku += name[getRandomInt(0, name.length - 1)];
          }

          switch (details.numberOfUnits.toString().length) {
            case 1:
              generatedSku += `00${details.numberOfUnits}`;
              break;
            case 2:
              generatedSku += `0${details.numberOfUnits}`;
              break;
            default:
              generatedSku += details.numberOfUnits;
              break;
          }

          generatedSku += details.brand.abbreviation;

          const dateTime = getLACurrentDateTime();
          const year = dateTime.get('year').toString();
          const week = dateTime.weekNumber.toString();

          generatedSku += year[year.length - 1];
          generatedSku += week.length === 1 ? `0${week}` : week;

          const isRepetitive = await pool.query(findSkuSql, [
            generatedSku.toLowerCase(),
          ]);

          generatedSku = generatedSku.toUpperCase();

          if (isRepetitive.rowCount === 0) {
            finished = true;
          }
        }

        await pool.query(addGeneratedSkuSql, [generatedSku]);

        return generatedSku;
      } catch (error: any) {
        console.log('generateSku err', error);
        throw new Error(error);
      }
    },
  },
};

export default generator;

interface BrandsQueryResult {
  id: string;
  name: string;
  abbreviation: string;
}

type BrandsResult = RelayStyle<BrandsQueryResult>;

interface GenerateSkuInput {
  productName: string;
  numberOfUnits: number;
  brand: BrandsQueryResult;
}

type BrandsSortableColumns = 'NAME' | 'ABBREVIATION';

export interface BrandsInput {
  searchTerm: string;
  sort: SortInput<BrandsSortableColumns>;
}
