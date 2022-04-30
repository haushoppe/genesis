import * as Joi from 'joi';

export const configuration = () => {
  return {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    manifoldServerUrl: process.env.MANIFOLD_SERVER_URL,
    manifoldAppId: process.env.MANIFOLD_APP_ID,
    manifoldMasterKey: process.env.MANIFOLD_MASTER
  }
}

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production'),
  PORT: Joi.number(),
  MANIFOLD_SERVER_URL: Joi.string().required(),
  MANIFOLD_APP_ID: Joi.string().required(),
  MANIFOLD_MASTER_KEY: Joi.string().required()
})
