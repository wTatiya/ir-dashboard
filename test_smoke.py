import pathlib
import unittest


class TestDashboardSmoke(unittest.TestCase):
    def test_index_html_exists(self) -> None:
        repo_root = pathlib.Path(__file__).resolve().parent
        index_file = repo_root / "index.html"
        self.assertTrue(index_file.exists(), "index.html should exist in the repo root")


if __name__ == "__main__":
    unittest.main()
