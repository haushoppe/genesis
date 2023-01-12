import * as Joi from 'joi';

export const configuration = () => {
  return {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    mongodbUri: process.env.MONGODB_URI,
  }
}

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production'),
  PORT: Joi.number(),
  MONGODB_URI: Joi.string().required(),
})
