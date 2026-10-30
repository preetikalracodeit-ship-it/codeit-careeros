const request = require('supertest');
const { randomUUID } = require('crypto');

const BASE_URL =
  process.env.TEST_API_BASE_URL || 'http://localhost:8080';

const api = request(BASE_URL);

/**
 * Extracts accessToken from the API response.
 * Supports the response envelope used by the original Java tests:
 * { data: { accessToken: "..." } }
 *
 * If the backend returns a different structure, update this helper
 * to match TestSupport.token() exactly.
 */
function extractAccessToken(response) {
  const body = response.body;

  const token =
    body?.data?.accessToken ??
    body?.accessToken;

  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(
      `Unable to extract accessToken from response: ${JSON.stringify(body)}`
    );
  }

  return token;
}

function authorized(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function registerStudent({
  fullName,
  email,
  mobile,
  password = 'Password1',
}) {
  return api
    .post('/api/v1/auth/register')
    .set('Content-Type', 'application/json')
    .send({
      fullName,
      email,
      mobile,
      password,
      termsAccepted: true,
    });
}

async function loginAdmin() {
  const response = await api
    .post('/api/v1/auth/login')
    .set('Content-Type', 'application/json')
    .send({
      email: 'admin@test.local',
      password: 'Admin@123Test',
    });

  expect(response.status).toBe(200);
  expect(response.body.data.user.role).toBe('ADMIN');

  return extractAccessToken(response);
}

describe('Admin Authorization Integration Tests', () => {
  jest.setTimeout(30000);

  test('Anonymous access to admin endpoint returns 401', async () => {
    const response = await api.get('/api/v1/admin/students');

    expect(response.status).toBe(401);
  });

  test('STUDENT cannot access admin endpoints (403)', async () => {
    const registration = await registerStudent({
      fullName: 'Blocked Student',
      email: `blocked-${randomUUID()}@test.local`,
      mobile: '9876543210',
    });

    expect(registration.status).toBe(201);

    const studentToken = extractAccessToken(registration);

    const response = await api
      .get('/api/v1/admin/students')
      .set(authorized(studentToken));

    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe('FORBIDDEN');
  });

  test('ADMIN role can access admin endpoints', async () => {
    const adminToken = await loginAdmin();

    // Verify the authenticated admin profile.
    const profileResponse = await api
      .get('/api/v1/admin/me')
      .set(authorized(adminToken));

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.role).toBe('ADMIN');

    // Verify that the admin can retrieve the student list.
    const studentsResponse = await api
      .get('/api/v1/admin/students')
      .set(authorized(adminToken));

    expect(studentsResponse.status).toBe(200);
    expect(Array.isArray(studentsResponse.body.data.content)).toBe(true);

    // Verify the student count endpoint.
    const countResponse = await api
      .get('/api/v1/admin/students/count')
      .set(authorized(adminToken));

    expect(countResponse.status).toBe(200);
    expect(typeof countResponse.body.data.count).toBe('number');
    expect(Number.isFinite(countResponse.body.data.count)).toBe(true);
  });

  test('ADMIN student search filters the full result set before pagination', async () => {
    const email = `search-${randomUUID()}@test.local`;

    const searchableStudent = await registerStudent({
      fullName: 'Searchable Student',
      email,
      mobile: '9876543210',
    });

    expect(searchableStudent.status).toBe(201);

    const newerEmail = `newer-${randomUUID()}@test.local`;

    const newerStudent = await registerStudent({
      fullName: 'Newer Nonmatch',
      email: newerEmail,
      mobile: '9876543211',
    });

    expect(newerStudent.status).toBe(201);

    const adminToken = await loginAdmin();

    const response = await api
      .get('/api/v1/admin/students')
      .query({
        page: 0,
        size: 1,
        search: email,
      })
      .set(authorized(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.totalElements).toBe(1);
    expect(response.body.data.content).toHaveLength(1);
    expect(response.body.data.content[0].email).toBe(email);
  });
});
