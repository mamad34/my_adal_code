import {
  accessTokenFailedMessage,
  authenticateInventoryUser,
} from '@dius-workspace/server/authentication-functions';
import {
  calculateProductTierSize,
  dateShortFormat,
  findRealFbaFee,
  getLACurrentDateTime,
  productImages,
} from '@dius-workspace/server/functions-shared';
import type {
  FilterInput,
  ImageType,
  RelayInput,
  RelayStyle,
  SortInput,
  SortType,
} from '@dius-workspace/server/types';
import { ServerScreensNamesEnum } from '@dius-workspace/shared/screens-categories';
import { IResolvers } from '@graphql-tools/utils';
import { DateTime } from 'luxon';
import pgp from 'pg-promise';
import { ACCESS_TOKEN } from '..';
import { pool } from '../services/pg';
import {
  addGeneratedSkuSql,
  createBrandBeforeLaunchSql,
  createBrandSql,
  deleteBrandSql,
  findSkuSql,
  getAllBeforeLaunchBrandsSql,
  getAllBrandsSql,
  getChinaAirTransferSkuSql,
  getChinaAirTransferSql,
  getChinaAirTrasferPurchaseSql,
  updateBrandBeforeLaunchSql,
  updateBrandSql,
  getWarehouseReceivingScheduleSql,
  getWarehouseReceivingItemLocationSql,
  addWarehouseReceivingScheduleSql,
  addWarehouseReceivingItemSql,
  addWarehouseReceivingItemPalletSql,
  getAllPurchasesSql,
  getMamadFbaFeeConflictsSql,
  mamadGetAllCogsSql,
  getMamadRatingSql,
  getMamadwarehouseAvailableInventorySql,
  MamadWarehouseInAndOutSql,
  MamadTTMSql,
  getMamadTotalTTMSql,
} from '../SQL/Generator';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRatingGiveaways = (item: MamadRatingQueryResult) => {
  const giveaways: MamadRatingGiveaways = {
    giveAway1: null,
    giveAway10: null,
    giveAway2: null,
    giveAway3: null,
    giveAway4: null,
    giveAway5: null,
    giveAway6: null,
    giveAway7: null,
    giveAway8: null,
    giveAway9: null,
  };

  if (item.rate_change) {
    for (
      let index = 0;
      index < item.rate_change.length && index <= 10;
      index++
    ) {
      const element = item.rate_change[index];

      giveaways[`giveAway${index + 1}` as keyof MamadRatingGiveaways] = element;
    }
  }

  return giveaways;
};

const generator: IResolvers = {
  // mapping

  MamadWarehouseAvailableInventoryFilterableColumns: {
    NUMBER_OF_BOXES: 'wai.number_of_boxes',
    UNIT: 'wai.units_per_box',
    TOTAL: '(wai.number_of_boxes * wai.units_per_box)',
    UNIT_PRICE: 'wai.unit_price',
    TOTAL_PRICE: '(wai.number_of_boxes * wai.units_per_box * wai.unit_price)',
  },
  MamadWarehouseAvailableInventorySortableColumns: {
    LOCATION: 'wai.placement',
    SKU: 'p.sku',
    REVEIVING_DATE: 'wai.receiving_date',
    HALL: 'wai.hall',
    NUMBER_OF_BOXES: 'wai.number_of_boxes',
    UNIT: 'wai.units_per_box',
    TOTAL: '(wai.number_of_boxes * wai.units_per_box)',
    UNIT_PRICE: 'wai.unit_price',
    TOTAL_PRICE: '(wai.number_of_boxes * wai.units_per_box * wai.unit_price)',
    COMMENT: ' wai.comments',
    STORE_NAME: 's.name',
  },

  MamadPurchasesSortableColumns: {
    SKU: 'pu.sku',
    NOTES: 'notes',
    TOTAL_PRICE: '(cp.price * units)',
    AMOUNT: 'amount',
    UNIT_PRICE: 'cp.units',
    DATE: 'date_time',
    STATUS: 'pu.status',
    ETD: 'etd',
    INVOICE_NUMBER: 'invoice_number',
    VENDOR_NAME: 'vendor_name',
    VENDOR_EMAIL: 'vendor_emails',
  },
  MamadPurchasesFilterableColumns: {
    AMOUNT: 'amount',
    UNIT_PRICE: 'cp.units',
    TOTAL_PRICE: '(cp.price * units)',
  },

  BeforeLaunchBrandsSortableColumns: {
    SKU: 'p.sku',
    ASIN: 'p.asin',
    TITLE_AND_BACKEND: 'bl.title_backend',
    TITLE_AND_BACKEND_NOTE: 'bl.title_backend_note',
    PICS_AND_DESCRIPTIVE: 'bl.pics_descriptive',
    PICS_AND_DESCRIPTIVE_NOTE: 'bl.pics_descriptive_note',
  },

  MamadWarehouseInAndOutSortableColumns: {
    SKU: 'p.sku',
    SKU_ID: 'p.id',
    TOTAL: 't.total',
  },
  MamadWarehouseInAndOutFilterableColumns: {
    TOTAL: 't.total',
  },

  MamadTTMSortableColumns: {
    SKU: 'p.sku',
    MONTH_1: 'items_1',
    MONTH_2: 'items_2',
    MONTH_3: 'items_3',
    MONTH_4: 'items_4',
    MONTH_5: 'items_5',
    MONTH_6: 'items_6',
    MONTH_7: 'items_7',
    MONTH_8: 'items_8',
    MONTH_9: 'items_9',
    MONTH_10: 'items_10',
    MONTH_11: 'items_11',
    MONTH_12: 'items_12',
  },
  MamadTTMFilterableColumns: {
    MONTH_1: 'items_1',
    MONTH_2: 'items_2',
    MONTH_3: 'items_3',
    MONTH_4: 'items_4',
    MONTH_5: 'items_5',
    MONTH_6: 'items_6',
    MONTH_7: 'items_7',
    MONTH_8: 'items_8',
    MONTH_9: 'items_9',
    MONTH_10: 'items_10',
    MONTH_11: 'items_11',
    MONTH_12: 'items_12',
  },

  Query: {
    getMamadTotalTTM: async (
      _parent,
      { details }: { details: getMamadTotalTTMDetails },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const dates: MamadTTMToalDateRange[] = [];

        const lastMonth =
          details.year === DateTime.now().get('year')
            ? DateTime.now().minus({ months: 1 }).set({
                day: 1,
              })
            : DateTime.now().set({
                day: 1,
                month: 12,
                year: details.year,
              });

        for (let index = 0; index < 12; index++) {
          const startMonth = lastMonth.minus({ months: index });
          const endMonth = startMonth.plus({ months: 1 }).minus({ days: 1 });

          dates.push({
            fromDate: startMonth.toFormat(dateShortFormat),
            toDate: endMonth.toFormat(dateShortFormat),
          });
        }

        console.log(
          'dick to mamad: ',
          pgp.as.format(getMamadTotalTTMSql({ dates }), [user.shopId])
        );

        const res = await pool.query<MamadTotalTTMQueryResult>(
          getMamadTotalTTMSql({ dates }),
          [user.shopId]
        );

        const result: MamadTotalTTMResult[] = [];
        for (let j = 0; j < dates.length; j++) {
          const date = dates[j];
          // res.rows[0].items5 =  res.rows[0][`items${j + 1}` as keyof MamadTotalTTMQueryResult], ;
          result.push({
            amount:
              res.rows[0][`items_${j + 1}` as keyof MamadTotalTTMQueryResult],
            date: date.fromDate,
          });
        }

        return result;
      } catch (error: any) {
        console.log('error in getMamadTotalTTM ' + error);
        throw new Error(error);
      }
    },
    mamadTTM: async (
      _parent,
      { first, after, details }: RelayInput<MamadTTMInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const dates: MamadTTMDateRange[] = [];
        const lastMonth = details.year
          ? DateTime.now().minus({ months: 1 }).set({
              day: 1,
            })
          : DateTime.now().set({
              day: 1,
              month: 12,
              year: details.year,
            });

        for (let index = 0; index < 12; index++) {
          const startMonth = lastMonth.minus({ months: index });
          const endMonth = startMonth.plus({ months: 1 }).minus({ days: 1 });

          dates.push({
            fromDate: startMonth.toFormat(dateShortFormat),
            toDate: endMonth.toFormat(dateShortFormat),
          });
        }

        const res = await pool.query<MamadTTMQueryResult>(
          MamadTTMSql({
            first: first + 1,
            after,
            details,
            dates,
          }),
          [user.shopId]
        );

        console.log(
          'dick to mamad: ',
          pgp.as.format(
            MamadTTMSql({
              details,
              first: first + 1,
              after,
              dates,
            }),
            [user.shopId]
          )
        );

        const hasNextPage = res.rowCount === first + 1;

        const result: MamadTTMResult = {
          edges: [],
          pageInfo: {
            hasNextPage,
            endCursor: first + after,
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
              sku: item.sku,
              items1: item.items_1,
              items2: item.items_2,
              items3: item.items_3,
              items4: item.items_4,
              items5: item.items_5,
              items6: item.items_6,
              items7: item.items_7,
              items8: item.items_8,
              items9: item.items_9,
              items10: item.items_10,
              items11: item.items_11,
              items12: item.items_12,
              orders1: item.orders_1,
              orders2: item.orders_2,
              orders3: item.orders_3,
              orders4: item.orders_4,
              orders5: item.orders_5,
              orders6: item.orders_6,
              orders7: item.orders_7,
              orders8: item.orders_8,
              orders9: item.orders_9,
              orders10: item.orders_10,
              orders11: item.orders_11,
              orders12: item.orders_12,
            },
          });
        }

        return result;
      } catch (error: any) {
        console.log('ERROR IN mamadTTM ', error);
        throw new Error(error);
      }
    },
    mamadWarehouseInAndOut: async (
      _parent,
      { first, after, details }: RelayInput<mamadWarehouseInAndOutInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });

      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const res = await pool.query<MamadWarehouseInAndOutSqlResult>(
          MamadWarehouseInAndOutSql({
            first: first + 1,
            after,
            details,
          }),
          [user.shopId, details.startDate, details.endDate]
        );

        const hasNextPage = res.rowCount === first + 1;

        const result: MamadWarehouseInAndOutResult = {
          edges: [],
          pageInfo: {
            hasNextPage,
            endCursor: first + after,
          },
        };

        for (
          let i = 0;
          i < (hasNextPage ? res.rowCount - 1 : res.rowCount);
          i++
        ) {
          const item = res.rows[i];

          // let total = 0;
          const inAndOuts: InAndOutsDetails[] = [];
          if (item.in_and_outs) {
            for (let j = 0; j < item.in_and_outs.length; j++) {
              const inAndOut = item.in_and_outs[j];

              // if (inAndOut.inboundsOutbounds) {
              //   for (let k = 0; k < inAndOut.inboundsOutbounds.length; k++) {
              //     const element = inAndOut.inboundsOutbounds[k];
              //     total += element;
              //   }
              // }

              // if (inAndOut.adjustments) {
              //   for (let l = 0; l < inAndOut.adjustments.length; l++) {
              //     const element = inAndOut.adjustments[l];
              //     total += element;
              //   }
              // }

              inAndOuts.push({
                date: inAndOut.date,
                adjustments: inAndOut.adjustments ?? [],
                inboundsOutbounds: inAndOut.inboundsOutbounds ?? [],
              });
            }
          }

          result.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              sku: item.sku,
              inAndOuts,
              total: item.total ?? 0,
            },
          });
        }

        return result;
      } catch (error: any) {
        console.log('Error in mamadWarehouseInAndOut: ', error);
        throw new Error(error);
      }
    },

    mamadWarehouseAvailableInventory: async (
      _parent,
      {
        first,
        after,
        details,
      }: RelayInput<MamadWarehouseAvailableInventoryInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const res =
          await pool.query<MamadWarehouseAvailableInventoryQueryResult>(
            getMamadwarehouseAvailableInventorySql({
              first: first + 1,
              after,
              details,
            }),
            ['1']
          );

        const hasNextPage = res.rowCount === first + 1;

        const result: MamadWarehouseAvailableInventoryResult = {
          edges: [],
          pageInfo: {
            hasNextPage,
            endCursor: first + after,
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
              sku: item.sku,
              unit: item.units_per_box,
              comment: item.comments,
              hall: item.hall,
              location: item.placement,
              numberOfBoxes: item.number_of_boxes,
              reveivingDate: item.receiving_date,
              storeName: item.name,
              total: item.total,
              totalPrice: item.total_price,
              unitPrice: item.unit_price ?? 0,
              editable: item.editable,
            },
          });
        }

        return result;
      } catch (error: any) {
        console.log('error in mamadWarehouseAvailableInventory', error);
        throw new Error(error);
      }
    },
    mamadRatingChanges: async (
      _parent,
      { first, after, details }: RelayInput<MamadRatingChangesInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const res = await pool.query<MamadRatingQueryResult>(
          getMamadRatingSql({
            first: first + 1,
            after,
            details,
          }),
          [user.shopId]
        );
        const hasNextPage = res.rowCount === first + 1;

        const rates: MamadRatingResult = {
          edges: [],
          pageInfo: {
            hasNextPage,
            endCursor: first + after,
          },
        };

        for (let i = 0; hasNextPage ? res.rowCount - 1 : res.rowCount; i++) {
          const element = res.rows[i];

          const giveaways = getRatingGiveaways(element);
          rates.edges.push({
            cursor: 'number',
            node: {
              id: element.id,
              sku: element.sku,
              image: productImages(element.small_image, element.big_image),
              rate: element.latest_rate ?? 0,
              globalRating: element.latest_global_rating ?? 0,
              ...giveaways,
            },
          });
        }
      } catch (error: any) {
        throw new Error(error);
      }
    },
    mamadCogs: async (
      _parent,
      { first, after, details }: RelayInput<MamadCogsInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const startDate = DateTime.fromFormat(
          details.startDate,
          dateShortFormat
        );
        const endDate = DateTime.fromFormat(details.endDate, dateShortFormat);
        const days = Math.floor(endDate.diff(startDate, 'days').days) + 1;

        const dates: string[] = [];
        for (let index = 0; index < days; index++) {
          dates.push(startDate.plus({ days: index }).toFormat(dateShortFormat));
        }

        console.log(
          'dick to mamad: ',
          pgp.as.format(
            mamadGetAllCogsSql({
              details,
              first: first + 1,
              after,
              dates,
            }),
            [user.shopId]
          )
        );

        const res = await pool.query<MamadCogsQueryResult>(
          mamadGetAllCogsSql({
            details,
            first: first + 1,
            after,
            dates,
          }),
          [user.shopId]
        );

        const hasNextPage = res.rowCount === first + 1;

        const cogs: MamadcogsResult = {
          edges: [],
          pageInfo: {
            hasNextPage,
            endCursor: first + after,
          },
        };

        for (
          let i = 0;
          i < (hasNextPage ? res.rowCount - 1 : res.rowCount);
          i++
        ) {
          const element = res.rows[i];

          const cogsHistory: EachCogHistory[] = [];
          for (let index = 0; index < dates.length; index++) {
            const date = dates[index];

            cogsHistory.push({
              date,
              cogs: element[`cogs_${index + 1}`] ?? 0,
              items: element[`amount_${index + 1}`] ?? 0,
            });
          }

          cogs.edges.push({
            cursor: 'number',
            node: {
              id: element.id,
              sku: element.sku,
              cogsHistory,
            },
          });
        }
        return cogs;
      } catch (error: any) {
        throw new Error(error);
      }
    },
    mamadFbaFeeConflicts: async (_parent, _args, { auth }, _info) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const res = await pool.query<MamadFbaFeeConflictsSqlResult>(
          getMamadFbaFeeConflictsSql
        );
        // vase real fba fee aval bayad fba tier ro mohasebe koni bad mitoni fba
        // fee ro begiri
        // real fba tier function: calculateProductTierSize vorodia sizesh az
        // unit size ha miad mesle unit_length ke to products hast is small and
        // light ham to products hast
        // bad ke tier bedast omad midi be findRealFbaFee function va real fba
        // fee bedast miad

        // fba tier ba hamon function bala bedast miad vali beja unit bayad
        // package size ro bedi mesle package_length
        const result: MamadFbaFeeConflictResult = {
          edges: [],
          pageInfo: {
            endCursor: 0,
            hasNextPage: false,
          },
        };
        for (let i = 0; i < res.rowCount; i++) {
          const item = res.rows[i];

          const realFbaTier = calculateProductTierSize(
            item.unit_weight ?? 0,
            item.unit_length ?? 0,
            item.unit_width ?? 0,
            item.unit_height ?? 0
          );
          const realFbaFee = findRealFbaFee({
            fbaTier: realFbaTier,
            height: item.unit_height ?? 0,
            length: item.unit_length ?? 0,
            weight: item.unit_weight ?? 0,
            width: item.unit_width ?? 0,
            isSmallAndLight: item.is_small_and_light,
          });
          const fbaTier = calculateProductTierSize(
            item.package_weight ?? 0,
            item.package_length ?? 0,
            item.package_width ?? 0,
            item.package_height ?? 0
          );

          result.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              sku: item.sku,
              fbaFee: item.fba_fee ?? 0,
              image: productImages(item.small_image, item.big_image),
              realFbaFee,
              realFbaTier,
              fbaTier,
              caseDate: item.case_date,
              change1: {
                oldFbaFee: item.old_fba_change_1,
                newFbaFee: item.new_fba_change_1,
                date: item.date_change_1,
              },
              change2: {
                oldFbaFee: item.old_fba_change_2,
                newFbaFee: item.new_fba_change_2,
                date: item.date_change_2,
              },
              change3: {
                oldFbaFee: item.old_fba_change_3,
                newFbaFee: item.new_fba_change_3,
                date: item.date_change_3,
              },
              change4: {
                oldFbaFee: item.old_fba_change_4,
                newFbaFee: item.new_fba_change_4,
                date: item.date_change_4,
              },
              change5: {
                oldFbaFee: item.old_fba_change_5,
                newFbaFee: item.new_fba_change_5,
                date: item.date_change_5,
              },
              change6: {
                oldFbaFee: item.old_fba_change_6,
                newFbaFee: item.new_fba_change_6,
                date: item.date_change_6,
              },
              change7: {
                oldFbaFee: item.old_fba_change_7,
                newFbaFee: item.new_fba_change_7,
                date: item.date_change_7,
              },
              change8: {
                oldFbaFee: item.old_fba_change_8,
                newFbaFee: item.new_fba_change_8,
                date: item.date_change_8,
              },
              change9: {
                oldFbaFee: item.old_fba_change_9,
                newFbaFee: item.new_fba_change_9,
                date: item.date_change_9,
              },
              change10: {
                oldFbaFee: item.old_fba_change_10,
                newFbaFee: item.new_fba_change_10,
                date: item.date_change_10,
              },
            },
          });
        }
        return result;
      } catch (error: any) {
        throw new Error(error);
      }
    },
    mamadPurchases: async (
      _parent,
      { first, after, details }: RelayInput<MamadPurchasesInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const res = await pool.query<PurchasesQueryResult>(
          getAllPurchasesSql({
            details,
            first: first + 1,
            after,
          }),
          [user.shopId]
        );

        const hasNextPage = res.rowCount === first + 1;

        const purchases: MamadPurchaseResult = {
          edges: [],
          pageInfo: {
            endCursor: first + after,
            hasNextPage,
          },
        };

        for (
          let i = 0;
          i < (hasNextPage ? res.rowCount - 1 : res.rowCount);
          i++
        ) {
          const item = res.rows[i];

          const img = productImages(item.small_image, item.big_image);
          purchases.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              amount: item.amount,
              date: item.date,
              etd: item.etd,
              image: img,
              invoiceNumber: item.invoice_number,
              notes: item.notes,
              sku: item.sku,
              status: item.status,
              totalPrice: item.total_price,
              unitPrice: item.price,
              vendorEmails: item.vendor_emails,
              vendorName: item.vendor_name,
            },
          });
        }
        return purchases;
      } catch (error: any) {
        throw new Error(error);
      }
    },
    // image: productImages(item.small_image,item.big_image)
    mamadWarehouseReceivingSchedule: async (
      _parent,
      { id }: { id: number },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const resWarehouseReceivingSchedule =
          await pool.query<GetWarehouseReceivingScheduleQueryResult>(
            getWarehouseReceivingScheduleSql,
            [id]
          );

        const resWarehouseReceivingItem =
          await pool.query<GetWarehouseReceivingItemQueryResult>(
            getWarehouseReceivingItemLocationSql,
            [id]
          );

        const skus: WarehouseReceivingItem[] = [];

        for (let i = 0; i < resWarehouseReceivingItem.rowCount; i++) {
          const element = resWarehouseReceivingItem.rows[i];

          const warehouseReceivingItemLocationQueryResult =
            await pool.query<WarehouseReceivingItemLocationQueryResult>(
              getWarehouseReceivingItemLocationSql,
              [element.id]
            );
          const location: MamadWarehouseReceivingItemLocation[] = [];
          for (
            let j = 0;
            j < warehouseReceivingItemLocationQueryResult.rowCount;
            j++
          ) {
            const rs = warehouseReceivingItemLocationQueryResult.rows[j];
            location.push({
              id: rs.id,
              numberOfBoxes: rs.number_of_boxes,
              placement: rs.placement,
            });
          }

          skus.push({
            id: element.id,
            numberOfBoxes: element.number_of_boxes,
            numberOfUnits: element.number_of_units,
            sku: element.sku,
            skuId: element.sku_id,
            skuInvoiceNumber: element.sku_invoice_number,
            locations: location,
          });
        }
        const result: WarehouseReceivingScheduleDetails = {
          companyName: resWarehouseReceivingSchedule.rows[0].company_name,
          deliveryDate: resWarehouseReceivingSchedule.rows[0].delivery_date,
          id: resWarehouseReceivingSchedule.rows[0].id,
          etd: resWarehouseReceivingSchedule.rows[0].etd,
          notes: resWarehouseReceivingSchedule.rows[0].notes,
          preReceived: resWarehouseReceivingSchedule.rows[0].pre_received,
          received: resWarehouseReceivingSchedule.rows[0].received,
          status: resWarehouseReceivingSchedule.rows[0].status,
          skus,
        };
        return result;
      } catch (error: any) {
        console.log('mamadWarehouseReceivingSchedule Error', error);
        throw new Error(error);
      }
    },
    mamadChinaAirTransferDetails: async (
      _parent,
      { id }: { id: number },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          access: 'VIEW',
          name: new Set<ServerScreensNamesEnum>(['BRANDS']),
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }
      try {
        const resGetChinaAirTransfer =
          await pool.query<GetChinaAirTransferQueryResult>(
            getChinaAirTransferSql,
            [id]
          );
        const resGetChinaAirTransferSku =
          await pool.query<GetChinaAirTransferSkuQueryResult>(
            getChinaAirTransferSkuSql,
            [id]
          );

        const skus: MamadChinaAirTransferSku[] = [];
        for (
          let index = 0;
          index < resGetChinaAirTransferSku.rowCount;
          index++
        ) {
          const element = resGetChinaAirTransferSku.rows[index];

          const purchases: MamadChinaAirTransferSkuPurchase[] = [];
          const resChinaAirTrasferPurchase =
            await pool.query<GetChinaAirTrasferPurchaseQueryResult>(
              getChinaAirTrasferPurchaseSql,
              [element.id]
            );
          for (let i = 0; i < resChinaAirTrasferPurchase.rowCount; i++) {
            const purchase = resChinaAirTrasferPurchase.rows[i];

            purchases.push({
              id: purchase.id,
              note: purchase.note,
              puchaseId: purchase.purchase_id,
              units: purchase.units,
            });
          }

          skus.push({
            id: element.id,
            purchases,
            sku: element.sku,
            skuId: element.sku_id,
            unitPrice: element.unit_price,
            unitsPerBox: element.units_per_box,
          });
        }

        const result: MamadChinaAirTransferDetails = {
          id: resGetChinaAirTransfer.rows[0].id,
          etd: resGetChinaAirTransfer.rows[0].etd,
          airFreightCost: resGetChinaAirTransfer.rows[0].air_freight_cost,
          airNumber: resGetChinaAirTransfer.rows[0].air_number,
          otherCost: resGetChinaAirTransfer.rows[0].other_cost,
          status: resGetChinaAirTransfer.rows[0].status,
          skus,
        };
        return result;
      } catch (error: any) {
        throw new Error(error.message);
      }
    },

    beforeLaunchBrands: async (
      _parent,
      { first, after, details }: RelayInput<BeforeLaunchBrandsInput>,
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
        const res = await pool.query<BeforeLaunchBrandsQueryResult>(
          getAllBeforeLaunchBrandsSql(details, first ? first + 1 : null, after)
        );

        const hasNextPage = first ? res.rowCount === first + 1 : false;

        const beforeLaunchBrands: BeforeLaunchBrandsResult = {
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
          beforeLaunchBrands.edges.push({
            cursor: 'number',
            node: {
              id: item.id,
              sku: item.sku,
              asin: item.asin || '',
              titleAndBackendNote: item.pics_descriptive_note ?? '',
              titleAndBackend: item.title_backend ? item.title_backend : '',
              picsAndDescriptive: item.pics_descriptive ?? '',
              picsAndDescriptiveNote: item.pics_descriptive_note || '',
              price: item.price ?? 0,
            },
          });
        }
        return beforeLaunchBrands;
      } catch (error: any) {
        console.log('Error in beforeLaunchBrands', error);
      }
    },
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
    addMamadWarehouseReceivingSchedule: async (
      _parent,
      { details }: { details: AddWarehouseReceivingScheduleInput },
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
        const createdWarehouseReceivingSchedule = await pool.query<{
          id: string;
        }>(addWarehouseReceivingScheduleSql, [
          details.companyId,
          details.deliveryDate,
          details.deliveryTime,
          details.shipmentInvoiceNumber,
          details.containerNumber,
          details.timeIn,
          details.timeOut,
          details.notes,
          details.etd,
          details.eta,
          details.men,
          details.timeScheduleHour,
          details.timeScheduleMinute,
          'SCHEDULED',
          false,
          true,
          false,
          '1',
        ]);

        for (let index = 0; index < details.skus.length; index++) {
          const element = details.skus[index];

          const createdWarehouseReceivingItem = await pool.query<{
            id: string;
          }>(addWarehouseReceivingItemSql, [
            element.skuId,
            element.numberOfUnits,
            element.numberOfBoxes,
            element.skuInvoiceNumber,
            createdWarehouseReceivingSchedule.rows[0].id,
            '1',
          ]);

          for (let i = 0; i < element.pallets.length; i++) {
            const pallet = element.pallets[i];
            await pool.query(addWarehouseReceivingItemPalletSql, [
              createdWarehouseReceivingItem.rows[0].id,
              element.numberOfUnits,
              element.numberOfBoxes,
              pallet.placement,
              '1',
            ]);
          }
        }
        return true;
      } catch (error: any) {
        console.log('addwarehouserecivingscheduleError', error);
        throw new Error(error);
      }
    },
    addBeforeLaunchBrand: async (
      _parent,
      { details }: { details: AddBeforeLaunchBrandInput },
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
        const brand = await pool.query(createBrandBeforeLaunchSql, [
          details.skuId,
          details.titleAndBackend,
          details.titleAndBackendNote,
          details.picsAndDescriptive,
          details.picsAndDescriptiveNote,
        ]);
        return brand ? true : false;
      } catch (err) {
        console.log('Error', err);
      }
    },
    editBrandBeforeLaunch: async (
      _parent,
      { details }: { details: EditBeforeLaunchBrandInput },
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
        const brand = await pool.query(updateBrandBeforeLaunchSql, [
          details.titleAndBackend,
          details.titleAndBackendNote,
          details.picsAndDescriptive,
          details.picsAndDescriptiveNote,
          details.id,
        ]);
        return brand.rows[0];
      } catch (err) {
        console.log('editBrandBeforeLaunch ERROR : ' + err);
      }
    },
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

interface BeforeLaunchBrandsNode {
  id: string;
  sku: string;
  asin: string;
  price: number;
  titleAndBackend: string;
  titleAndBackendNote: string;
  picsAndDescriptive: string;
  picsAndDescriptiveNote: string;
}

type BeforeLaunchBrandsResult = RelayStyle<BeforeLaunchBrandsNode>;

type BeforeLaunchBrandsSortableColumns =
  | 'p.sku'
  | 'p.asin'
  | 'bl.title_backend'
  | 'bl.title_backend_note'
  | 'bl.pics_descriptive'
  | 'bl.pics_descriptive_note';

type BeforeLaunchBrandsFilterableColumns = 'PRICE';

interface BeforeLaunchBrandsQueryResult {
  id: string;
  title_backend: string | null;
  title_backend_note: string | null;
  pics_descriptive: string | null;
  pics_descriptive_note: string | null;
  sku: string;
  asin: string | null;
  price: number | null;
}

export interface BeforeLaunchBrandsInput {
  searchTerm: string;
  sort: SortInput<BeforeLaunchBrandsSortableColumns>;
  filters: FilterInput<BeforeLaunchBrandsFilterableColumns>[];
}

interface AddBeforeLaunchBrandInput {
  skuId: string;
  titleAndBackend: string | null;
  titleAndBackendNote: string | null;
  picsAndDescriptive: string | null;
  picsAndDescriptiveNote: string | null;
}

interface EditBeforeLaunchBrandInput {
  id: string;
  titleAndBackend: string | null;
  titleAndBackendNote: string | null;
  picsAndDescriptive: string | null;
  picsAndDescriptiveNote: string | null;
}

interface GetChinaAirTransferQueryResult {
  id: string;
  air_number: string;
  air_freight_cost: number;
  other_cost: number;
  etd: string;
  status: string;
}

interface MamadChinaAirTransferDetails {
  id: string;
  airNumber: string;
  airFreightCost: number;
  otherCost: number;
  etd: string;
  status: string;
  skus: MamadChinaAirTransferSku[];
}

interface MamadChinaAirTransferSku {
  id: string;
  sku: string;
  skuId: string;
  unitsPerBox: number;
  unitPrice: number;
  purchases: MamadChinaAirTransferSkuPurchase[];
}

interface MamadChinaAirTransferSkuPurchase {
  id: string;
  puchaseId: string;
  units: number;
  note: string;
}

interface GetChinaAirTransferSkuQueryResult {
  id: string;
  sku: string;
  sku_id: string;
  units_per_box: number;
  unit_price: number;
}

interface GetChinaAirTrasferPurchaseQueryResult {
  id: string;
  purchase_id: string;
  units: number;
  note: string;
}

interface GetWarehouseReceivingScheduleQueryResult {
  id: string;
  company_name: string;
  delivery_date: string;
  status: string;
  pre_received: boolean;
  received: boolean;
  notes: string;
  etd: string;
}

interface GetWarehouseReceivingItemQueryResult {
  id: string;
  sku: string;
  sku_id: string;
  number_of_boxes: number;
  number_of_units: number;
  sku_invoice_number: string | null;
}

interface WarehouseReceivingScheduleDetails {
  id: string;
  companyName: string;
  deliveryDate: string;
  status: string;
  preReceived: boolean;
  received: boolean;
  etd: string;
  notes: string;
  skus: WarehouseReceivingItem[];
}

interface WarehouseReceivingItem {
  id: string;
  sku: string;
  skuId: string;
  numberOfBoxes: number;
  numberOfUnits: number;
  skuInvoiceNumber: string | null;
  locations: MamadWarehouseReceivingItemLocation[];
}

interface MamadWarehouseReceivingItemLocation {
  id: string;
  placement: string;
  numberOfBoxes: number;
}

interface WarehouseReceivingItemLocationQueryResult {
  id: string;
  placement: string;
  number_of_boxes: number;
}

interface AddWarehouseReceivingScheduleInput {
  companyId: string;
  deliveryDate: string | null;
  deliveryTime: string | null;
  shipmentInvoiceNumber: string | null;
  containerNumber: string | null;
  timeIn: string | null;
  timeOut: string | null;
  notes: string | null;
  etd: string | null;
  eta: string | null;
  men: number | null;
  timeScheduleHour: number | null;
  timeScheduleMinute: number | null;
  skus: WarehouseReceivingItemInput[];
}

interface WarehouseReceivingItemInput {
  skuId: string;
  numberOfUnits: number;
  numberOfBoxes: number;
  skuInvoiceNumber: string | null;
  pallets: WarehouseReceivingItemPalletInput[];
}

interface WarehouseReceivingItemPalletInput {
  placement: string;
}
// mamad purchases interfaces and types
export interface MamadPurchasesInput {
  searchTerm: string;
  sort: SortInput<MamadPurchasesSortableColumns>;
  filters: FilterInput<MamadPurchasesFilterableColumns>[];
}

interface MamadPurchaseNode {
  id: string;
  sku: string;
  image: ImageType;
  date: string;
  status: purchasesStatus;
  amount: number;
  etd: string;
  unitPrice: number;
  totalPrice: number;
  invoiceNumber: string;
  vendorName: string;
  vendorEmails: string[];
  notes: string;
}

interface PurchasesQueryResult {
  id: string;
  sku: string;
  small_image: string;
  big_image: string;
  date: string;
  status: purchasesStatus;
  amount: number;
  etd: string;
  price: number;
  total_price: number;
  invoice_number: string;
  vendor_name: string;
  vendor_emails: string[];
  notes: string;
}

interface MamadFbaFeeConflictsSqlResult {
  id: string;
  unit_weight: number | null;
  unit_length: number | null;
  unit_width: number | null;
  unit_height: number | null;
  package_weight: number | null;
  package_width: number | null;
  package_length: number | null;
  package_height: number | null;
  sku: string;
  image: ImageType;
  case_date: string;
  fba_fee: number | null;
  small_image: string;
  big_image: string;
  is_small_and_light: boolean;
  old_fba_change_1: number | null;
  new_fba_change_1: number | null;
  date_change_1: string | null;
  old_fba_change_2: number | null;
  new_fba_change_2: number | null;
  date_change_2: string | null;
  old_fba_change_3: number | null;
  new_fba_change_3: number | null;
  date_change_3: string | null;
  old_fba_change_4: number | null;
  new_fba_change_4: number | null;
  date_change_4: string | null;
  old_fba_change_5: number | null;
  new_fba_change_5: number | null;
  date_change_5: string | null;
  old_fba_change_6: number | null;
  new_fba_change_6: number | null;
  date_change_6: string | null;
  old_fba_change_7: number | null;
  new_fba_change_7: number | null;
  date_change_7: string | null;
  old_fba_change_8: number | null;
  new_fba_change_8: number | null;
  date_change_8: string | null;
  old_fba_change_9: number | null;
  new_fba_change_9: number | null;
  date_change_9: string | null;
  old_fba_change_10: number | null;
  new_fba_change_10: number | null;
  date_change_10: string | null;
}

interface MamadFbaFeeChange {
  oldFbaFee: number | null;
  newFbaFee: number | null;
  date: string | null;
}

interface MamadFbaFeeConflictNode {
  id: string;
  sku: string;
  image: ImageType;
  caseDate: string | null;
  fbaFee: number;
  realFbaFee: number;
  fbaTier: string;
  realFbaTier: string;
  change1: MamadFbaFeeChange;
  change2: MamadFbaFeeChange;
  change3: MamadFbaFeeChange;
  change4: MamadFbaFeeChange;
  change5: MamadFbaFeeChange;
  change6: MamadFbaFeeChange;
  change7: MamadFbaFeeChange;
  change8: MamadFbaFeeChange;
  change9: MamadFbaFeeChange;
  change10: MamadFbaFeeChange;
}

export interface MamadCogsInput {
  searchTerm: string;
  startDate: string;
  endDate: string;
  sort: MamadCogsSortInput;
  filters: MamadCogsFilterInput[];
}

interface MamadCogsSortInput {
  columnName: MamadCogsSortableColumns;
  cogsIndex: number | null;
  sortBy: SortType;
}

interface MamadCogsFilterInput {
  columnName: MamadCogsFilterableColumns;
  cogsIndex: number;
  biggerThan: number | null;
  lessThan: number | null;
}

type MamadCogsAmount = {
  [K in `amount_${number}`]: number | null;
};

type MamadCogsCogs = {
  [K in `cogs_${number}`]: number | null;
};

type MamadCogsQueryResult = {
  id: string;
  sku: string;
} & MamadCogsAmount &
  MamadCogsCogs;

interface MamadCogsNode {
  id: string;
  sku: string;
  cogsHistory: EachCogHistory[];
}

interface EachCogHistory {
  items: number;
  cogs: number;
  date: string;
}

export interface MamadRatingChangesInput {
  searchTerm: string;
  sort: MamadRatingSortInput;
  filters: MamadRatingFilterInput[];
}

interface MamadRatingSortInput {
  columnName: MamadRatingSortableColumns;
  sortBy: SortType;
}

interface MamadRatingFilterInput {
  columnName: MamadRatingFilterableColumns;
  biggerThan: number | null;
  lessThan: number | null;
}

interface MamadRatingGiveaways {
  giveAway1: MamadRatingGiveAway | null;
  giveAway2: MamadRatingGiveAway | null;
  giveAway3: MamadRatingGiveAway | null;
  giveAway4: MamadRatingGiveAway | null;
  giveAway5: MamadRatingGiveAway | null;
  giveAway6: MamadRatingGiveAway | null;
  giveAway7: MamadRatingGiveAway | null;
  giveAway8: MamadRatingGiveAway | null;
  giveAway9: MamadRatingGiveAway | null;
  giveAway10: MamadRatingGiveAway | null;
}

interface MamadRatingNode extends MamadRatingGiveaways {
  id: string;
  sku: string;
  image: ImageType;
  rate: number;
  globalRating: number;
}

interface MamadRatingGiveAway {
  oldRating: number;
  newRating: number;
  date: string;
}

interface MamadRatingQueryResult {
  id: string;
  sku: string;
  big_image: string;
  small_image: string;
  latest_rate: number | null;
  latest_global_rating: number | null;
  rate_change: MamadRatingGiveAway[] | null;
}
export interface MamadWarehouseAvailableInventoryInput {
  searchTerm: string;
  sort: SortInput<MamadWarehouseAvailableInventorySortableColumns>;
  filters: FilterInput<MamadWarehouseAvailableInventoryFilterableColumns>[];
}
interface MamadWarehouseAvailableInventoryQueryResult {
  id: string;
  placement: string;
  sku: string;
  receiving_date: string | null;
  hall: string | null;
  number_of_boxes: number | null;
  units_per_box: number | null;
  total: number | null;
  unit_price: number | null;
  total_price: number | null;
  comments: string | null;
  name: string | null;
  editable: boolean | null;
}

interface MamadWarehouseAvailableInventoryNode {
  id: string;
  location: string;
  sku: string;
  reveivingDate: string | null;
  hall: string | null;
  numberOfBoxes: number | null;
  unit: number | null;
  total: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  comment: string | null;
  storeName: string | null;
  editable: boolean | null;
}

type MamadWarehouseAvailableInventoryResult =
  RelayStyle<MamadWarehouseAvailableInventoryNode>;

type MamadWarehouseInAndOutSortableColumns = 'SKU' | 'SKU_ID' | 'TOTAL';

type MamadWarehouseInAndOutFilterableColumns = 'TOTAL';

export interface mamadWarehouseInAndOutInput {
  searchTerm: string;
  startDate: string;
  endDate: string;
  sort: SortInput<MamadWarehouseInAndOutSortableColumns>;
  filters: FilterInput<MamadWarehouseInAndOutFilterableColumns>[];
}

interface MamadWarehouseInAndOutNode {
  id: string;
  sku: string;
  total: number;
  inAndOuts: InAndOutsDetails[];
}

interface InAndOutsDetails {
  inboundsOutbounds: number[];
  adjustments: number[];
  date: string;
}

type MamadWarehouseInAndOutResult = RelayStyle<MamadWarehouseInAndOutNode>;

interface MamadWarehouseInAndOutSqlResult {
  id: string;
  sku: string;
  total: number | null;
  in_and_outs: inAndOutsResult[] | null;
}

interface inAndOutsResult {
  date: string;
  inboundsOutbounds: number[] | null;
  adjustments: number[] | null;
}

interface getMamadTotalTTMDetails {
  year: number;
}

//mage to schema ba _ minvisim???
type MamadTTMNode = {
  id: string;
  sku: string;
} & MamadTTMItemsResult &
  MamadTTMOrdersResult;

type MamadTTMResult = RelayStyle<MamadTTMNode>;

export interface MamadTTMInput {
  searchTerm: string;
  year: number;
  sort: SortInput<MamadTTMSortableColumns>;
  filters: FilterInput<MamadTTMFilterableColumns>[];
}

export interface MamadTTMDateRange {
  fromDate: string | null;
  toDate: string | null;
}

export interface MamadTotalTTMQueryResult {
  items_1: number;
  items_2: number;
  items_3: number;
  items_4: number;
  items_5: number;
  items_6: number;
  items_7: number;
  items_8: number;
  items_9: number;
  items_10: number;
  items_11: number;
  items_12: number;
}

export interface MamadTTMToalDateRange {
  fromDate: string;
  toDate: string;
}

interface MamadTotalTTMResult {
  date: string;
  amount: number;
}

type MamadTTMMonthNumbers = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

type MamadTTMItemsResult = {
  [K in `items${MamadTTMMonthNumbers}`]: number | null;
};

type MamadTTMOrdersResult = {
  [K in `orders${MamadTTMMonthNumbers}`]: number | null;
};

type MamadTTMItemsQueryResult = {
  [K in `items_${MamadTTMMonthNumbers}`]: number | null;
};

type MamadTTMOrdersQueryResult = {
  [K in `orders_${MamadTTMMonthNumbers}`]: number | null;
};

type MamadTTMQueryResult = {
  id: string;
  sku: string;
} & MamadTTMItemsQueryResult &
  MamadTTMOrdersQueryResult;

type MamadTTMSortableColumns =
  | 'SKU'
  | 'MONTH_1'
  | 'MONTH_2'
  | 'MONTH_3'
  | 'MONTH_4'
  | 'MONTH_5'
  | 'MONTH_6'
  | 'MONTH_7'
  | 'MONTH_8'
  | 'MONTH_9'
  | 'MONTH_10'
  | 'MONTH_11'
  | 'MONTH_12';

type MamadTTMFilterableColumns =
  | 'MONTH_1'
  | 'MONTH_2'
  | 'MONTH_3'
  | 'MONTH_4'
  | 'MONTH_5'
  | 'MONTH_6'
  | 'MONTH_7'
  | 'MONTH_8'
  | 'MONTH_9'
  | 'MONTH_10'
  | 'MONTH_11'
  | 'MONTH_12';

type MamadWarehouseAvailableInventoryFilterableColumns =
  | 'wai.number_of_boxes'
  | 'wai.units_per_box'
  | 'wai.number_of_boxes * wai.units_per_box'
  | 'wai.unit_price'
  | '(wai.number_of_boxes * wai.units_per_box * wai.unit_price)';

type MamadWarehouseAvailableInventorySortableColumns =
  | 'wai.placement'
  | 'p.sku'
  | 'wai.receiving_date'
  | 'wai.hall'
  | 'wai.number_of_boxes'
  | 'wai.units_per_box'
  | 'wai.number_of_boxes * wai.units_per_box'
  | 'wai.unit_price'
  | '(wai.number_of_boxes * wai.units_per_box * wai.unit_price)'
  | ' wai.comments'
  | 's.name';

type MamadRatingResult = RelayStyle<MamadRatingNode>;

type MamadRatingSortableColumns = 'SKU' | 'RATE' | 'GLOBAL_RATING';

type MamadRatingFilterableColumns = 'RATE' | 'GLOBAL_RATING';

type MamadcogsResult = RelayStyle<MamadCogsNode>;

type MamadCogsSortableColumns = 'SKU' | 'COGS';

type MamadCogsFilterableColumns = 'COGS';

type MamadFbaFeeConflictResult = RelayStyle<MamadFbaFeeConflictNode>;

type MamadPurchaseResult = RelayStyle<MamadPurchaseNode>;

type purchasesStatus = 'DRAFTED' | 'CANCELLED' | 'APPROVED';

type MamadPurchasesSortableColumns =
  | 'SKU'
  | 'NOTES'
  | 'AMOUNT'
  | 'UNIT_PRICE'
  | 'TOTAL_PRICE'
  | 'DATE'
  | 'STATUS'
  | 'ETD'
  | 'INVOICE_NUMBER'
  | 'VENDOR_NAME'
  | 'VENDOR_EMAIL';

type MamadPurchasesFilterableColumns = 'AMOUNT' | 'UNIT_PRICE' | 'TOTAL_PRICE';
