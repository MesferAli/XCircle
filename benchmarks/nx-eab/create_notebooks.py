"""
Script to generate Kaggle-uploadable .ipynb notebooks from the benchmark Python files.
Run: python benchmarks/nx-eab/create_notebooks.py
"""
import nbformat
import os

NOTEBOOK_DIR = os.path.dirname(os.path.abspath(__file__))


def create_notebook(source_file: str, output_name: str, title: str, track: str) -> str:
    """Create a Kaggle-ready .ipynb notebook from a Python source file."""
    with open(os.path.join(NOTEBOOK_DIR, source_file), "r") as f:
        source_code = f.read()

    nb = nbformat.v4.new_notebook()
    nb.metadata["kernelspec"] = {
        "display_name": "Python 3",
        "language": "python",
        "name": "python3"
    }
    nb.metadata["kaggle"] = {
        "accelerator": "none",
        "dataSources": [],
        "isGpuEnabled": False,
        "isInternetEnabled": True,
        "language": "python",
        "sourceType": "notebook"
    }

    # Title cell
    nb.cells.append(nbformat.v4.new_markdown_cell(
        f"# {title}\n\n"
        f"**Track:** {track}\n\n"
        f"**Author:** Mesfer AlOtaibi | XCircle Technology Company (xcircle.sa)\n\n"
        f"**Patent:** Saudi AI Context Middleware Platform (SA 1020259266)\n\n"
        f"**Competition:** Kaggle \"Measuring AGI: Cognitive Abilities\" Hackathon\n\n"
        f"---\n\n"
        f"Run all cells below to execute the benchmark."
    ))

    # Code cell with the full benchmark
    nb.cells.append(nbformat.v4.new_code_cell(source_code))

    output_path = os.path.join(NOTEBOOK_DIR, output_name)
    with open(output_path, "w") as f:
        nbformat.write(nb, f)

    return output_path


if __name__ == "__main__":
    ef_path = create_notebook(
        "nx_eab_executive_functions.py",
        "nx_eab_executive_functions.ipynb",
        "NX-EAB: Executive Agentic Benchmark — Executive Functions",
        "Executive Functions"
    )
    print(f"Created: {ef_path}")

    sc_path = create_notebook(
        "nx_eab_social_cognition.py",
        "nx_eab_social_cognition.ipynb",
        "NX-EAB: Executive Agentic Benchmark — Social Cognition",
        "Social Cognition"
    )
    print(f"Created: {sc_path}")
