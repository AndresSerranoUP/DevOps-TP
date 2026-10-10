import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DataStore } from '../src/store/data-store';
import { InMemoryDataStore } from './in-memory-data-store';

describe('End-to-End & Integration Test Suite', () => {
  let app: INestApplication;
  let inMemoryStore: InMemoryDataStore;

  beforeAll(async () => {
    inMemoryStore = new InMemoryDataStore();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataStore)
      .useValue(inMemoryStore)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    inMemoryStore.clear();
  });

  describe('Flow 1: User Lifecycle (Register -> Verify Email -> Login -> Token -> Authorized calls)', () => {
    it('executes the complete authentication and authorization lifecycle', async () => {
      const email = 'player1@gamingtrends.com';
      const password = 'StrongPassword123!';
      const username = 'PlayerOne';

      // 1. Register user
      const registerRes = await request(app.getHttpServer())
        .post('/api/User/Create')
        .send({
          emailUser: email,
          passwordUser: password,
          usernameUser: username,
          imgAvatar: 'avatar1.png',
        })
        .expect(200);

      expect(registerRes.text).toContain('User registered. Check your email for verification.');

      // 2. Attempt login before email verification -> fails with 401
      const preVerifyLoginRes = await request(app.getHttpServer())
        .post('/api/login')
        .send({
          emailUser: email,
          passwordUser: password,
        })
        .expect(401);

      expect(preVerifyLoginRes.body.message).toContain('User needs to verify its email to login to this website!');

      // 3. Verify email
      const verifyRes = await request(app.getHttpServer())
        .get(`/api/User/verify-email?email=${encodeURIComponent(email)}`)
        .expect(200);

      expect(verifyRes.text).toBe('true');

      // 4. Login after verification -> succeeds with token
      const loginRes = await request(app.getHttpServer())
        .post('/api/login')
        .send({
          emailUser: email,
          passwordUser: password,
        })
        .expect(200);

      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.emailUser).toBe(email);
      const userToken = loginRes.body.token;

      // 5. Authorized call using Bearer token
      // Create a game to purchase
      const dev = await inMemoryStore.insert<any>('Developers', { NameDeveloper: 'TestDev' });
      const game = await inMemoryStore.insert<any>('Games', {
        NameGame: 'Test Game',
        Price: 15,
        IdDeveloper: dev.IdDeveloper,
        Disabled: 0,
      });

      const addGameRes = await request(app.getHttpServer())
        .post('/api/UserGames')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ idGame: game.IdGame })
        .expect(200);

      expect(addGameRes.text).toBe('true');

      // 6. Unauthorized call without token fails
      await request(app.getHttpServer())
        .post('/api/UserGames')
        .send({ idGame: game.IdGame })
        .expect(401);
    });
  });

  describe('Flow 2: Game Creation, Rating, StoreFront & Soft Deletion', () => {
    it('creates game, rates game, verifies storefront metrics and soft deletes', async () => {
      // 1. Register & verify user
      const email = 'reviewer@games.com';
      const password = 'Password99!';
      await request(app.getHttpServer())
        .post('/api/User/Create')
        .send({ emailUser: email, passwordUser: password, usernameUser: 'Reviewer' })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/User/verify-email?email=${encodeURIComponent(email)}`)
        .expect(200);

      const loginRes = await request(app.getHttpServer())
        .post('/api/login')
        .send({ emailUser: email, passwordUser: password })
        .expect(200);

      const token = loginRes.body.token;

      // 2. Create Developer
      const devRes = await request(app.getHttpServer())
        .post('/api/Developer/Create')
        .send({ nameDeveloper: 'Epic Studios', shortDescription: 'Top indie studio' })
        .expect(200);

      const devId = devRes.body.idDeveloper;

      // 3. Create Game
      const gameRes = await request(app.getHttpServer())
        .post('/api/Game/Create')
        .send({
          nameGame: 'Cyber Adventure',
          idDeveloper: devId,
          price: 49.99,
          genresIds: [1, 2],
        })
        .expect(200);

      const gameId = gameRes.body.idGame;
      expect(gameRes.body.disabled).toBe(1); // Forced disabled on creation

      // 4. Enable game via MinUpdate
      await request(app.getHttpServer())
        .put(`/api/Game/MinUpdate/${gameId}`)
        .send({ disabled: 0 })
        .expect(200);

      // 5. Check storefront before purchase
      const storePreRes = await request(app.getHttpServer())
        .get(`/api/Game/GetById/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(storePreRes.body.isOwned).toBe(false);
      expect(storePreRes.body.likes).toBe(0);
      expect(storePreRes.body.dislikes).toBe(0);

      // 6. Attempt rating without owning the game -> 400 Bad Request
      await request(app.getHttpServer())
        .post(`/api/Game/Rate/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ likes: 1 })
        .expect(400);

      // 7. User buys game
      await request(app.getHttpServer())
        .post('/api/UserGames')
        .set('Authorization', `Bearer ${token}`)
        .send({ idGame: gameId })
        .expect(200);

      // 8. User rates game (Like)
      const rateRes = await request(app.getHttpServer())
        .post(`/api/Game/Rate/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ likes: 1 })
        .expect(200);

      expect(rateRes.text).toBe('Gracias por tu opinion');

      // 9. Check storefront after rating
      const storePostRes = await request(app.getHttpServer())
        .get(`/api/Game/GetById/${gameId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(storePostRes.body.isOwned).toBe(true);
      expect(storePostRes.body.userRate).toBe(1);
      expect(storePostRes.body.likes).toBe(1);
      expect(storePostRes.body.dislikes).toBe(0);

      // 10. Soft delete game
      await request(app.getHttpServer())
        .delete(`/api/Game/Delete/${gameId}`)
        .expect(200);

      // 11. Subsequent GetById returns 404 because game is disabled
      await request(app.getHttpServer())
        .get(`/api/Game/GetById/${gameId}`)
        .expect(404);
    });
  });

  describe('Flow 3: Pagination and Sorting with PageResult', () => {
    it('paginates and sorts records returning PageResult structure', async () => {
      const dev = await inMemoryStore.insert<any>('Developers', { NameDeveloper: 'PagDev' });

      // Seed 5 games
      for (let i = 1; i <= 5; i++) {
        await inMemoryStore.insert('Games', {
          NameGame: `Game #${i}`,
          Price: i * 10,
          IdDeveloper: dev.IdDeveloper,
          Disabled: 0,
        });
      }

      // Page 1 with pageSize 2
      const page1Res = await request(app.getHttpServer())
        .get('/api/Game/GetAll?page=1&pageSize=2&ascending=true')
        .expect(200);

      expect(page1Res.body.pageNumber).toBe(1);
      expect(page1Res.body.pageSize).toBe(2);
      expect(page1Res.body.totalNumberOfRecords).toBe(5);
      expect(page1Res.body.totalNumberOfPages).toBe(3);
      expect(page1Res.body.results).toHaveLength(2);
      expect(page1Res.body.nextPageUrl).toContain('page=2');
      expect(page1Res.body.previousPageUrl).toBeFalsy();

      // Page 2
      const page2Res = await request(app.getHttpServer())
        .get('/api/Game/GetAll?page=2&pageSize=2&ascending=true')
        .expect(200);

      expect(page2Res.body.pageNumber).toBe(2);
      expect(page2Res.body.results).toHaveLength(2);
      expect(page2Res.body.previousPageUrl).toContain('page=1');
      expect(page2Res.body.nextPageUrl).toContain('page=3');

      // Sorting descending by Price
      const sortDescRes = await request(app.getHttpServer())
        .get('/api/Game/GetAll?page=1&pageSize=5&orderBy=Price&ascending=false')
        .expect(200);

      expect(sortDescRes.body.results[0].price).toBe(50);
      expect(sortDescRes.body.results[4].price).toBe(10);
    });
  });

  describe('Flow 4: User Library (UserGames/GetUserLibrary)', () => {
    it('returns user library with game details and genres', async () => {
      const user = await inMemoryStore.insert<any>('Users', {
        EmailUser: 'lib@test.com',
        PasswordUser: 'hash',
        UsernameUser: 'LibraryUser',
        IsVerified: true,
      });

      const dev = await inMemoryStore.insert<any>('Developers', { NameDeveloper: 'DevStudios' });
      const game = await inMemoryStore.insert<any>('Games', {
        NameGame: 'Metroidvania X',
        Price: 20,
        IdDeveloper: dev.IdDeveloper,
        Disabled: 0,
      });

      const genre = await inMemoryStore.insert<any>('Genres', { NameGenre: 'Platformer', Disabled: 0 });
      await inMemoryStore.insert('GamesGenres', { IdGame: game.IdGame, IdGenre: genre.IdGenre });
      await inMemoryStore.insert('UsersGames', { IdUser: user.IdUser, IdGame: game.IdGame, BuyDate: new Date() });

      const res = await request(app.getHttpServer())
        .get(`/api/UserGames/GetUserLibrary/${user.IdUser}`)
        .expect(200);

      expect(res.body.user.idUser).toBe(user.IdUser);
      expect(res.body.gamesData).toHaveLength(1);
      expect(res.body.gamesData[0].game.nameGame).toBe('Metroidvania X');
      expect(res.body.gamesData[0].genres).toHaveLength(1);
      expect(res.body.gamesData[0].genres[0].nameGenre).toBe('Platformer');
      expect(res.body.gamesData[0].buyDate).toBeDefined();
    });
  });

  describe('Flow 5: Catalog Endpoints (Genres, Roles, SocialLinks, Developers, Media)', () => {
    it('exposes genres endpoints', async () => {
      const list = await request(app.getHttpServer()).get('/api/Genre/GetAll').expect(200);
      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.length).toBeGreaterThanOrEqual(3);

      const single = await request(app.getHttpServer()).get('/api/Genre/GetById/1').expect(200);
      expect(single.body.idGenre).toBe(1);
      expect(single.body.nameGenre).toBe('Action');
    });

    it('exposes roles endpoints', async () => {
      const list = await request(app.getHttpServer()).get('/api/Role/GetAll').expect(200);
      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.length).toBeGreaterThanOrEqual(2);

      const single = await request(app.getHttpServer()).get('/api/Role/GetById/1').expect(200);
      expect(single.body.idRole).toBe(1);
      expect(single.body.roleName).toBe('User');
    });

    it('exposes social links endpoints', async () => {
      const dev = await inMemoryStore.insert<any>('Developers', { NameDeveloper: 'DevSocial' });
      const link = await inMemoryStore.insert<any>('SocialLinks', {
        NameSocialLink: 'Twitter',
        UrlSocialLink: 'https://x.com/dev',
        IdDeveloper: dev.IdDeveloper,
        Disabled: 0,
      });

      const list = await request(app.getHttpServer()).get('/api/SocialLink/GetAll').expect(200);
      expect(list.body).toHaveLength(1);

      const single = await request(app.getHttpServer()).get(`/api/SocialLink/GetById/${link.IdSocialLink}`).expect(200);
      expect(single.body.webName).toBe('Twitter');
      expect(single.body.webUrl).toBe('https://x.com/dev');
    });

    it('exposes developer search endpoints', async () => {
      await inMemoryStore.insert('Developers', { NameDeveloper: 'Nintendo EPD' });
      await inMemoryStore.insert('Developers', { NameDeveloper: 'Naughty Dog' });

      const searchRes = await request(app.getHttpServer())
        .get('/api/Developer/GetDevelopersByName/Nintendo')
        .expect(200);

      expect(searchRes.body).toHaveLength(1);
      expect(searchRes.body[0].nameDeveloper).toBe('Nintendo EPD');
    });

    it('exposes media endpoints for screenshots and featured', async () => {
      const dev = await inMemoryStore.insert<any>('Developers', { NameDeveloper: 'MediaDev' });
      const game = await inMemoryStore.insert<any>('Games', {
        NameGame: 'MediaGame',
        Price: 20,
        IdDeveloper: dev.IdDeveloper,
        Disabled: 0,
      });

      // Add Screenshot (type 5)
      await request(app.getHttpServer())
        .post('/api/Media/CreateMedia')
        .send({ idGame: game.IdGame, idMediaType: 5, url: 'https://img.com/shot1.png' })
        .expect(200);

      const shotList = await request(app.getHttpServer())
        .get(`/api/Media/GetScreenshotsByGame/${game.IdGame}`)
        .expect(200);

      expect(shotList.body).toHaveLength(1);
      expect(shotList.body[0].url).toBe('https://img.com/shot1.png');

      // Add Featured (type 2)
      await request(app.getHttpServer())
        .post('/api/Media/CreateMedia')
        .send({ idGame: game.IdGame, idMediaType: 2, url: 'https://img.com/featured.png' })
        .expect(200);

      const featuredList = await request(app.getHttpServer())
        .get('/api/Media/GetRandomFeatured')
        .expect(200);

      expect(featuredList.body).toHaveLength(1);
      expect(featuredList.body[0].url).toBe('https://img.com/featured.png');
      expect(featuredList.body[0].nameGame).toBe('MediaGame');
    });
  });

  describe('Flow 6: Health Endpoints (/health and /health/ready)', () => {
    it('returns ok for liveness check', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('returns ok for readiness check when data store ping succeeds', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(res.body).toEqual({
        status: 'ok',
        info: { database: { status: 'up' } },
      });
    });

    it('returns 503 Service Unavailable when data store is down', async () => {
      inMemoryStore.setHealthy(false);
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
      expect(res.body).toEqual({
        status: 'error',
        error: { database: { status: 'down' } },
      });
    });
  });
});
