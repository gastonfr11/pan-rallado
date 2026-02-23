import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Respondé con un solo mensaje corto: ¿estás funcionando?"}
    ]
)

print(message.content[0].text)