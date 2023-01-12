import * as Joi from 'joi';

export const configuration = () => {
  return {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    mongodbRestEndpoint: process.env.MONGODB_REST_ENDPOINT,
    mongodbApiKey: process.env.MONGODB_API_KEY,

  }
}

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production'),
  PORT: Joi.number(),
  MONGODB_REST_ENDPOINT: Joi.string().required(),
  MONGODB_API_KEY: Joi.string().required(),
})
