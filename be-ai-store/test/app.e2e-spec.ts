import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.database).toEqual([{ ok: 1 }]);
    expect(response.body.redis).toBe('PONG');
    expect(response.body.checkedAt).toBeDefined();
  });

  it('/admin/entities (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/entities')
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.some((entity) => entity.key === 'users')).toBe(true);
  });

  it('/admin/dashboard (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/dashboard')
      .expect(200);

    expect(response.body.cards).toBeDefined();
    expect(response.body.inventoryByStatus).toBeDefined();
    expect(response.body.ordersByStatus).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
