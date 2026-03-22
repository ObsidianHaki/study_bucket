from langchain_text_splitters import RecursiveCharacterTextSplitter 

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=100,
    separators=["\n\n", "\n", ". ", " "] 
)

