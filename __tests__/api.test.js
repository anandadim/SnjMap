const request = require('supertest');
const app = require('../server');

describe('API Endpoints Testing', () => {
    it('GET /api/locations should return list of locations', async () => {
        const res = await request(app).get('/api/locations');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('locations');
        expect(Array.isArray(res.body.locations)).toBeTruthy();
    });
});
