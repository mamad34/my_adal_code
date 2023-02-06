import { getLACurrentDateTime } from '@dius-workspace/server/functions-shared';
import fastifyCookie from '@fastify/cookie';
import {
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-fastify';
import { ApolloServerPlugin } from 'apollo-server-plugin-base';
import dotenv from 'dotenv';
import fastify, { FastifyRequest } from 'fastify';
import fs from 'fs';
import path from 'path';
import schema from './schema';

dotenv.config();

export const ACCESS_TOKEN = process.env.ACCESS_TOKEN
  ? process.env.ACCESS_TOKEN
  : '';

const PORT = process.env.PORT || 4006;
const env = process.env.NODE_ENV || 'development';
const IP = '0.0.0.0';

const myPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    return {
      async didEncounterErrors(requestContext) {
        fs.appendFile(
          path.join(
            __dirname,
            '../logs',
            `error${getLACurrentDateTime().toFormat('MM-dd-yyyy')}.txt`
          ),
          `an error happened in response to query
                              ${JSON.stringify(requestContext.request.query)}
                              ${JSON.stringify(requestContext.errors)}
                              Time ${getLACurrentDateTime().toISO()}
                              `,
          (err) => {
            if (err) {
              console.log(err);
            }
          }
        );
      },
    };
  },
};

const app = fastify({ trustProxy: true });

const server = new ApolloServer({
  schema,
  context: ({ request }: { request: FastifyRequest }) => {
    const auth = request.headers.authorization || '';
    return {
      auth,
    };
  },
  plugins: [
    myPlugin,
    env === 'production'
      ? ApolloServerPluginLandingPageDisabled()
      : ApolloServerPluginLandingPageGraphQLPlayground(),
  ],
  cache: 'bounded',
});

const corsOptions = {
  origin: ['http://localhost:4000'],
  optionsSuccessStatus: 200,
  credentials: true,
};

app.register(fastifyCookie, {
  secret: '9IJ7yZmN2XVG2oYbBKXAN+2PTStKYlmI9Xr',
});

server.start().then(() => {
  app.register(server.createHandler({ path: '/graphql', cors: corsOptions }));

  app.listen(PORT, IP, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Server is ready at port ${PORT}`);
    }
  });
});
