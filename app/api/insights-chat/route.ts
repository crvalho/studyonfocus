import { GoogleGenerativeAI } from "@google/generative-ai"
import { type NextRequest, NextResponse } from "next/server"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBY_7Y-pOb8QgRy5WOKSh6Dbcd1KVIacFc"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, context, documents = [] } = body

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `Você é um assistente de pesquisa especializado em analisar documentos e responder perguntas baseadas exclusivamente no conteúdo fornecido.

CONTEXTO DOS DOCUMENTOS:
${context}

DOCUMENTOS DISPONÍVEIS:
${documents.map((d: any) => `- ${d.name}`).join("\n")}

PERGUNTA DO USUÁRIO:
${message}

INSTRUÇÕES:
1. Responda a pergunta usando APENAS informações do contexto fornecido
2. Se a informação não estiver no contexto, seja honesto e diga que não encontrou
3. Cite especificamente de quais documentos você está tirando informações
4. Seja preciso, claro e objetivo
5. Use formatação em markdown quando apropriado

RESPOSTA:`

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    return NextResponse.json({ response })
  } catch (error: any) {
    console.error("Error in /api/insights-chat:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
