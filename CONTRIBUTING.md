# Contributing to SmartDump

Thank you for your interest in contributing to SmartDump! 🎉

## How to Contribute

### Reporting Issues

- Check if the issue already exists in [GitHub Issues](https://github.com/achelton/smartdump/issues)
- Provide a clear description and steps to reproduce
- Include Python version, OS, and relevant error messages

### Submitting Pull Requests

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/smartdump.git
   cd smartdump
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/my-awesome-feature
   ```

3. **Set up development environment**
   ```bash
   pip install -e ".[dev]"
   ```

4. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add tests if applicable

5. **Test your changes**
   ```bash
   pytest
   pytest --asyncio-mode=auto
   ```

6. **Commit with clear messages**
   ```bash
   git commit -am "Add feature: brief description"
   ```

7. **Push and create PR**
   ```bash
   git push origin feature/my-awesome-feature
   ```
   Then open a Pull Request on GitHub

## Development Guidelines

### Project Structure

```
smartdump/
├── client/          # Client library (sd() function)
│   ├── __init__.py
│   └── sd.py
├── server/          # FastAPI server
│   ├── __init__.py
│   ├── app.py
│   └── manager.py
├── static/          # Web UI (HTML, CSS, JS)
└── run.py           # Entry point
```

### Code Style

- Use type hints where possible
- Keep functions focused and single-purpose
- Write docstrings for public APIs
- Follow PEP 8 style guidelines

### Testing

- Add tests for new features
- Ensure existing tests still pass
- Test both client and server components

### Running the Server Locally

```bash
# Start the server
python run.py

# Or after installing
smartdump start

# Run example app
uvicorn example.app:app --port 8000 --reload
```

## Questions?

Open an issue or start a discussion on GitHub!

---

Thank you for contributing! 🚀
