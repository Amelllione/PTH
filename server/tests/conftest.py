def pytest_configure(config):
    config.addinivalue_line("markers", "covers(aspect): аспект требования, который проверяет тест (для автоматической пометки частичности)")
