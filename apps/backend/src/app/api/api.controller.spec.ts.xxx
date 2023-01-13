import { Test, TestingModule } from '@nestjs/testing';
import { ApiController } from './api.controller';

describe('Api Controller', () => {
  let controller: ApiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [
        // {
        //   provide: XXXService,
        //   useFactory: () => new XXXService({}),
        // },
      ],
    }).compile();

    controller = module.get<ApiController>(ApiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
