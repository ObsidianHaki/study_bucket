from doctest import DocTest

def get_pdf_entries(cursor :list[DocTest]):
    return [pdf_file["filename"] for pdf_file in cursor]

