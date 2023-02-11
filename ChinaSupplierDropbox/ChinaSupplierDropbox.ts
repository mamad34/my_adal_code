import {
  accessTokenFailedMessage,
  authenticateInventoryUser,
} from '@dius-workspace/server/authentication-functions';
import { generateBucketUploadLink } from '@dius-workspace/server/aws-bucket';
import {
  adalBucketName,
  chinaBucketTempFolder,
} from '@dius-workspace/server/strings-shared';
import {
  RelayInput,
  RelayStyle,
  SortInput,
} from '@dius-workspace/server/types';
import { ServerScreensNamesEnum } from '@dius-workspace/shared/screens-categories';
import { IResolvers } from '@graphql-tools/utils';
import { v4 as uuidv4 } from 'uuid';
import {
  ACCESS_TOKEN,
  DROPBOX_CLIENT_ID,
  DROPBOX_CLIENT_SECRET,
  DROPBOX_REFRESH_TOKEN,
} from '..';
import { pool } from '../services/pg';
import { Dropbox } from 'dropbox';
import {
  getInventoryChinaSupplierDropboxLinksSql,
  inventoryChinaSupplierDropboxLinksSql,
  updateInventoryChinaSupplierDropboxLinksSql,
} from '../SQL/ChinaSupplierDropbox';

const inventoryChinaSupplierDropboxLinksResolver: IResolvers = {
  InventoryChinaSupplierDropboxLinksSortableColumns: {
    NAME: 'cs.name',
  },
  Query: {
    inventoryChinaSupplierDropboxLinks: async (
      _parent,
      {
        first,
        after,
        details,
      }: RelayInput<InventoryChinaSupplierDropboxLinksInput>,
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['CHINA_SUPPLIER_DROPBOX']),
          access: 'VIEW',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const res =
          await pool.query<InventoryChinaSupplierDropboxLinksQueryResult>(
            inventoryChinaSupplierDropboxLinksSql({
              first: first + 1,
              after,
              details,
            }),
            [user.shopId]
          );

        const hasNextPage = res.rowCount === first + 1;

        const result: InventoryChinaSupplierDropboxLinksResult = {
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
              ciPlLink: item.ci_pl_link,
              piLink: item.pi_link,
            },
          });
        }

        return result;
      } catch (error: any) {
        console.log('inventoryChinaSupplierDropboxLinks err', error);
        throw new Error(error);
      }
    },
  },
  Mutation: {
    editInventoryChinaSupplierDropboxLinks: async (
      _parent,
      { details }: { details: EditInventoryChinaSupplierDropboxLinksInput },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>(['CHINA_SUPPLIER_DROPBOX']),
          access: 'EDIT',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const dbx = new Dropbox({
          clientId: DROPBOX_CLIENT_ID,
          clientSecret: DROPBOX_CLIENT_SECRET,
          refreshToken: DROPBOX_REFRESH_TOKEN,
        });

        let ciPlLink: string | null = null;
        let piLink: string | null = null;
        if (details.ciPlLink) {
          const res = await dbx.sharingGetSharedLinkMetadata({
            url: details.ciPlLink,
          });

          if (!res.result?.path_lower) {
            throw new Error('Failed to find the CI And PI path');
          }

          ciPlLink = res.result.path_lower;
        }

        if (details.piLink) {
          const res = await dbx.sharingGetSharedLinkMetadata({
            url: details.piLink,
          });

          if (!res.result?.path_lower) {
            throw new Error('Failed to find the CI And PI path');
          }

          piLink = res.result.path_lower;
        }

        const updated = await pool.query<{ id: string }>(
          updateInventoryChinaSupplierDropboxLinksSql,
          [ciPlLink, piLink, details.id]
        );

        if (!updated.rowCount) {
          throw new Error('Failed to edit dropbox links');
        }

        const res =
          await pool.query<InventoryChinaSupplierDropboxLinksQueryResult>(
            getInventoryChinaSupplierDropboxLinksSql,
            [details.id]
          );

        const item = res.rows[0];

        const supplierDropboxLinks: InventoryChinaSupplierDropboxLinksNode = {
          id: item.id,
          name: item.name,
          ciPlLink: item.ci_pl_link ?? '',
          piLink: item.pi_link ?? '',
        };

        return supplierDropboxLinks;
      } catch (error: any) {
        console.log('editInventoryChinaSupplierDropboxLinks err', error);
        throw new Error(error);
      }
    },
    getInventoryChinaTransferDropboxUploadLink: async (
      _parent,
      { details }: { details: InventoryChinaTransferDropboxUploadLinkInput },
      { auth },
      _info
    ) => {
      const user = await authenticateInventoryUser({
        userToken: auth,
        key: ACCESS_TOKEN,
        screenDetails: {
          name: new Set<ServerScreensNamesEnum>([
            'CHINA_AIR_TRANSFERS',
            'CHINA_SEA_TRANSFERS',
            'DIUS_CHINA_SEA_TRANSFERS',
          ]),
          access: 'VIEW',
        },
      });
      if (!user) {
        throw new Error(accessTokenFailedMessage);
      }

      try {
        const fileName = `${uuidv4()}/${details.fileName}`;
        const fileKey = `${chinaBucketTempFolder}/${fileName}`;
        const uploadLink = await generateBucketUploadLink({
          bucketKey: fileKey,
          bucketName: adalBucketName,
          expireDuration: 10 * 60,
          fileType: details.fileType,
        });

        const result: InventoryChinaTransferDropboxUploadLink = {
          fileName,
          link: uploadLink,
        };

        return result;
      } catch (error: any) {
        console.log('getInventoryChinaTransferDropboxUploadLink err', error);
        throw new Error(error);
      }
    },
  },
};

export default inventoryChinaSupplierDropboxLinksResolver;

type InventoryChinaSupplierDropboxLinksSortableColumns = 'cs.name';

export interface InventoryChinaSupplierDropboxLinksInput {
  searchTerm: string;
  sort: SortInput<InventoryChinaSupplierDropboxLinksSortableColumns>;
}

interface InventoryChinaSupplierDropboxLinksNode {
  id: string;
  name: string;
  ciPlLink: string | null;
  piLink: string | null;
}

type InventoryChinaSupplierDropboxLinksResult =
  RelayStyle<InventoryChinaSupplierDropboxLinksNode>;

interface InventoryChinaSupplierDropboxLinksQueryResult {
  id: string;
  name: string;
  ci_pl_link: string | null;
  pi_link: string | null;
}

interface InventoryChinaTransferDropboxUploadLinkInput {
  fileType: string;
  fileName: string;
}

interface InventoryChinaTransferDropboxUploadLink {
  link: string;
  fileName: string;
}

interface EditInventoryChinaSupplierDropboxLinksInput {
  id: string;
  ciPlLink: string | null;
  piLink: string | null;
}
