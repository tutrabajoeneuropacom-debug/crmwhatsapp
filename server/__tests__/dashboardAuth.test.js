describe('middleware/dashboardAuth', () => {
    afterEach(() => {
        jest.resetModules();
        delete process.env.NODE_ENV;
        delete process.env.DASHBOARD_API_KEY;
    });

    test('does not throw when DASHBOARD_API_KEY is missing in non-production', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.DASHBOARD_API_KEY;
        jest.resetModules();
        const mod = require('../middleware/dashboardAuth');
        expect(typeof mod.authenticateDashboard).toBe('function');
    });

    test('throws on require when NODE_ENV=production and DASHBOARD_API_KEY missing', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.DASHBOARD_API_KEY;
        expect(() => {
            jest.resetModules();
            require('../middleware/dashboardAuth');
        }).toThrow(/DASHBOARD_API_KEY is required/i);
    });
});
