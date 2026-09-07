import { AppController } from './app.controller';

// AppController has no injected dependencies, so it's constructed directly.
describe('AppController', () => {
  const controller = new AppController();

  it('serves the internal API landing page with the OpenAPI links', () => {
    const html = controller.getStart();
    expect(html).toContain('<title>🎨 API</title>');
    expect(html).toContain('This is an internal API. There is not much to see here.');
    expect(html).toContain('href="/open-api"');
    expect(html).toContain('href="/open-api-json"');
  });

  it('disallows all robots', () => {
    expect(controller.getRobotsTxt()).toBe('User-agent: *\nDisallow: /');
  });
});
