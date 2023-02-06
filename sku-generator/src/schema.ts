import { buildSubgraphSchema } from '@apollo/subgraph';
import {
  dateMillisecondScalar,
  dateShortScalar,
  iso8601Scalar,
  timeScalar,
} from '@dius-workspace/server/functions-shared';
import type { GraphqlContext } from '@dius-workspace/server/types';
import { mergeResolvers } from '@graphql-tools/merge';
import { GraphQLResolverMap } from 'apollo-graphql';
import { GraphQLSchema } from 'graphql';
import 'graphql-import-node';
import { GraphQLUpload } from 'graphql-upload';
import generatorResolver from './controllers/Generator';
import * as typeDefs from './schema/schema.graphql';

const schema: GraphQLSchema = buildSubgraphSchema([
  {
    typeDefs,
    resolvers: mergeResolvers([
      {
        Upload: GraphQLUpload,
        DateMillisecond: dateMillisecondScalar,
        DateShort: dateShortScalar,
        ISO8601: iso8601Scalar,
        Time: timeScalar,
      },
      generatorResolver,
    ]) as GraphQLResolverMap<GraphqlContext>,
  },
]);

export default schema;
