import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataStore } from '../src/store/data-store';
import { JwtGuard } from '../src/auth/jwt.guard';
import { MailService } from '../src/mail/mail.service';

describe('HTTP compatibility routes', () => {
  let app: INestApplication;

  const mockDataStore = {
    select: jest.fn().mockImplementation((query) => {
      if (query.table === 'Genres') return Promise.resolve([]);
      if (query.table === 'Games') return Promise.resolve([{ IdGame: 3, NameGame: 'Game', Price: 10, Disabled: 0 }]);
      return Promise.resolve([]);
    }),
    count: jest.fn().mockResolvedValue(0),
    query: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockImplementation((table) => {
      if (table === 'Developers') return Promise.resolve({ IdDeveloper: 1, NameDeveloper: 'Studio', Disabled: 0 });
      if (table === 'UsersGames') return Promise.resolve({ IdUser: 7, IdGame: 3 });
      return Promise.resolve({});
    }),
    update: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(1),
    transaction: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataStore)
      .useValue(mockDataStore)
      .overrideProvider(MailService)
      .useValue({
        sendVerificationEmail: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
      })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          context.switchToHttp().getRequest().user = { nameid: 7 };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('exposes the legacy genre collection route and JSON response', async () => {
    await request(app.getHttpServer()).get('/api/Genre/GetAll').expect(200).expect([]);
  });

  it('does not add administrator authorization to Backend-unprotected writes', async () => {
    await request(app.getHttpServer())
      .post('/api/Developer/Create')
      .send({ nameDeveloper: 'Studio' })
      .expect(200)
      .expect(res => {
        expect(res.body.idDeveloper).toBe(1);
        expect(res.body.IdDeveloper).toBeUndefined();
      });
  });

  it('returns exactly boolean true with status 200 for UserGames', async () => {
    await request(app.getHttpServer())
      .post('/api/UserGames')
      .send({ idGame: 3 })
      .expect(200)
      .expect(response => expect(response.text).toBe('true'));
  });
});
