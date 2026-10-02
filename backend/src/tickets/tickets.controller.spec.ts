import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: {
            create: jest.fn(),
            updateTicket: jest.fn(),
            arriveTicket: jest.fn(),
            noShowTicket: jest.fn(),
            returnTicket: jest.fn(),
            findAll: jest.fn(),
            callTicket: jest.fn(),
            startService: jest.fn(),
            completeTicket: jest.fn(),
            redirectTicket: jest.fn(),
            getBoardHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
