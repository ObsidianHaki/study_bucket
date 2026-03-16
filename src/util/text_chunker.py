from langchain_text_splitters import RecursiveCharacterTextSplitter 
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    separators=["\n\n", "\n", ". ", " "]
)

