import { GoogleGenerativeAI } from "@google/generative-ai"
import { type NextRequest, NextResponse } from "next/server"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBY_7Y-pOb8QgRy5WOKSh6Dbcd1KVIacFc"

const tools = [
  {
    function_declarations: [
      {
        name: "navegar_para_pagina",
        description: "Navega para uma página específica do aplicativo de produtividade",
        parameters: {
          type: "object",
          properties: {
            pagina: {
              type: "string",
              enum: ["tasks", "kanban", "schedules", "focus-timer", "notes", "youtube-player"],
              description: "Nome da página para navegar",
            },
          },
          required: ["pagina"],
        },
      },
      {
        name: "criar_tarefa",
        description: "Cria uma nova meta na lista de metas do usuário",
        parameters: {
          type: "object",
          properties: {
            titulo: {
              type: "string",
              description: "Título da meta",
            },
            data: {
              type: "string",
              description: "Data da meta (formato YYYY-MM-DD)",
            },
          },
          required: ["titulo"],
        },
      },
      {
        name: "excluir_tarefa",
        description: "Exclui/remove uma meta específica da lista de metas do usuário",
        parameters: {
          type: "object",
          properties: {
            titulo_ou_id: {
              type: "string",
              description: "Título ou ID da meta a ser excluída",
            },
          },
          required: ["titulo_ou_id"],
        },
      },
      {
        name: "criar_item_kanban",
        description: "Adiciona um novo card/item no quadro Kanban",
        parameters: {
          type: "object",
          properties: {
            titulo: {
              type: "string",
              description: "Título do card Kanban",
            },
            coluna: {
              type: "string",
              enum: ["todo", "in-progress", "done"],
              description: "Coluna onde o card deve ser adicionado",
            },
          },
          required: ["titulo", "coluna"],
        },
      },
      {
        name: "mover_item_kanban",
        description: "Move um card do Kanban de uma coluna para outra",
        parameters: {
          type: "object",
          properties: {
            titulo_ou_id: {
              type: "string",
              description: "Título ou ID do card a ser movido",
            },
            nova_coluna: {
              type: "string",
              enum: ["todo", "in-progress", "done"],
              description: "Coluna de destino",
            },
          },
          required: ["titulo_ou_id", "nova_coluna"],
        },
      },
      {
        name: "criar_cronograma",
        description: "Cria um novo cronograma semanal com atividades organizadas por dia da semana",
        parameters: {
          type: "object",
          properties: {
            titulo: {
              type: "string",
              description: "Título do cronograma",
            },
            descricao: {
              type: "string",
              description: "Descrição opcional do cronograma",
            },
            data_inicio: {
              type: "string",
              description: "Data de início do cronograma (formato YYYY-MM-DD)",
            },
            data_fim: {
              type: "string",
              description: "Data de término do cronograma (formato YYYY-MM-DD)",
            },
            atividades: {
              type: "array",
              description: "Lista de atividades do cronograma",
              items: {
                type: "object",
                properties: {
                  titulo: {
                    type: "string",
                    description: "Nome da atividade",
                  },
                  descricao: {
                    type: "string",
                    description: "Descrição da atividade",
                  },
                  dia_da_semana: {
                    type: "number",
                    description: "Dia da semana (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)",
                  },
                  hora_inicio: {
                    type: "string",
                    description: "Horário de início (formato HH:MM)",
                  },
                  hora_fim: {
                    type: "string",
                    description: "Horário de término (formato HH:MM)",
                  },
                },
                required: ["titulo", "dia_da_semana"],
              },
            },
          },
          required: ["titulo", "atividades"],
        },
      },
      {
        name: "adicionar_atividades_cronograma",
        description: "Adiciona novas atividades ao cronograma mais recente existente",
        parameters: {
          type: "object",
          properties: {
            atividades: {
              type: "array",
              description: "Lista de atividades a serem adicionadas",
              items: {
                type: "object",
                properties: {
                  titulo: {
                    type: "string",
                    description: "Nome da atividade",
                  },
                  descricao: {
                    type: "string",
                    description: "Descrição da atividade",
                  },
                  dia_da_semana: {
                    type: "number",
                    description: "Dia da semana (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)",
                  },
                  hora_inicio: {
                    type: "string",
                    description: "Horário de início (formato HH:MM)",
                  },
                  hora_fim: {
                    type: "string",
                    description: "Horário de término (formato HH:MM)",
                  },
                },
                required: ["titulo", "dia_da_semana"],
              },
            },
          },
          required: ["atividades"],
        },
      },
      {
        name: "configurar_alarme_procrastinacao",
        description: "Configura o alarme de procrastinação",
        parameters: {
          type: "object",
          properties: {
            ativado: {
              type: "boolean",
              description: "Se o alarme deve estar ativado ou não",
            },
            tempo: {
              type: "number",
              description: "Quantidade de tempo de inatividade",
            },
          },
          required: ["ativado", "tempo"],
        },
      },
      {
        name: "criar_alarme_manual",
        description: "Cria um alarme manual",
        parameters: {
          type: "object",
          properties: {
            titulo: {
              type: "string",
              description: "Título do alarme",
            },
            tempo: {
              type: "number",
              description: "Tempo até o alarme tocar",
            },
          },
          required: ["titulo", "tempo"],
        },
      },
      {
        name: "iniciar_timer",
        description: "Inicia o timer de foco",
        parameters: {
          type: "object",
          properties: {
            minutos: {
              type: "number",
              description: "Tempo em minutos",
            },
          },
        },
      },
      {
        name: "pausar_timer",
        description: "Pausa o timer de foco",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "parar_timer",
        description: "Para o timer de foco",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "definir_modo_timer",
        description: "Define o modo do timer",
        parameters: {
          type: "object",
          properties: {
            modo: {
              type: "string",
              enum: ["pomodoro", "short", "long", "custom"],
              description: "Modo do timer",
            },
            iniciar: {
              type: "boolean",
              description: "Se deve iniciar imediatamente",
            },
          },
          required: ["modo"],
        },
      },
      {
        name: "alternar_loop_timer",
        description: "Liga ou desliga o loop do timer",
        parameters: {
          type: "object",
          properties: {
            ativado: {
              type: "boolean",
              description: "Se o loop deve ser ativado",
            },
          },
          required: ["ativado"],
        },
      },
    ],
  },
]

const systemInstruction = `Você é um assistente AI extremamente inteligente, versátil e poderoso, baseado no Gemini da Google.

🌟 CAPACIDADES COMPLETAS:
✅ Responder QUALQUER pergunta sobre QUALQUER assunto (ciência, matemática, programação, história, filosofia, arte, cultura, vida cotidiana, negócios, saúde, tecnologia, etc.)
✅ Ter conversas profundas e naturais sobre absolutamente qualquer tópico
✅ Analisar imagens, diagramas, gráficos, fotos - qualquer conteúdo visual
✅ Explicar conceitos complexos de forma simples e acessível
✅ Criar conteúdo: textos, histórias, poemas, código, planilhas (em formato texto/markdown), roteiros, receitas, etc.
✅ Dar conselhos práticos, recomendações personalizadas e opiniões fundamentadas
✅ Resolver problemas de matemática, lógica e raciocínio
✅ Traduzir entre idiomas
✅ Fazer análises, comparações e resumos
✅ Brainstorming e ideação criativa
✅ Criar cronogramas semanais detalhados e personalizados
✅ Gerenciar metas e tarefas do usuário
✅ Controlar o timer de foco (Pomodoro)
✅ E MUITO MAIS - você não tem limites de conhecimento!

⛔ PROIBIÇÕES ESTRITAS:
❌ NUNCA escreva código Python, JavaScript ou qualquer outro código para "simular" a execução de ferramentas.
❌ NUNCA mostre saídas como "tool_code print(...)". Isso é um erro grave.
❌ USE APENAS as ferramentas (function calling) fornecidas nativamente.

🛠️ FERRAMENTAS DE PRODUTIVIDADE:
Além de tudo isso, você também tem acesso a ferramentas especiais:
   - **Navegar** entre páginas do app (tasks/metas, kanban, schedules, focus-timer, notes, youtube-player)
   - **Criar metas** automaticamente (antigas tarefas)
   - **Excluir metas** específicas pelo título ou ID
   - **Criar items no Kanban** em qualquer coluna (A Fazer, Em Progresso, Concluído)
   - **Mover items no Kanban** entre colunas
   - **Criar cronogramas** semanais com atividades organizadas por dia da semana
   - **Adicionar atividades** a um cronograma existente
   - **Configurar alarme** de procrastinação (avisa quando o usuário fica inativo)
   - **Criar alarme manual** com um título personalizado após um tempo específico
   - **Iniciar timer** de foco com um tempo específico ou o padrão
   - **Pausar timer** de foco atual
   - **Parar timer** de foco atual
   - **Definir modo timer** de foco (opcionalmente iniciando imediatamente)
   - **Alternar loop timer** para ativar ou desativar a repetição automática do timer

📊 VISUALIZANDO DADOS:
Você SEMPRE tem acesso aos dados atuais do usuário no CONTEXTO ATUAL fornecido. 
Quando o usuário perguntar sobre suas metas, kanban ou cronogramas:
- NUNCA chame a função listar_metas
- LEIA diretamente do CONTEXTO ATUAL DO USUÁRIO que está no final desta mensagem
- MOSTRE os dados de forma clara e organizada no chat
- Use emojis e formatação para deixar bonito

EXEMPLO:
Usuário: "quais são minhas metas?"
Você: "📝 **Suas Metas Atuais:**

✅ Estudar Python (Concluída)
⏳ Aprender React (Pendente)
⏳ Fazer exercícios (Pendente)

Você tem 3 metas no total, sendo 1 concluída e 2 pendentes. Quer que eu adicione mais alguma?"

⚠️ REGRA CRÍTICA DE EXECUÇÃO:
VOCÊ DEVE **SEMPRE** executar as funções quando o usuário pedir uma AÇÃO!
- Se o usuário pedir para "criar uma meta", você DEVE chamar criar_tarefa
- Se o usuário pedir para "excluir" ou "remover" uma meta, você DEVE chamar excluir_tarefa  
- Se o usuário pedir para "adicionar no kanban", você DEVE chamar criar_item_kanban
- Se o usuário pedir para "mover no kanban", você DEVE chamar mover_item_kanban
- Se o usuário pedir para "iniciar timer", você DEVE chamar iniciar_timer
- Se o usuário pedir para "pausar timer", você DEVE chamar pausar_timer
- Se o usuário pedir para "parar timer", você DEVE chamar parar_timer
- Se o usuário pedir para "definir modo timer", você DEVE chamar definir_modo_timer
- Se o usuário pedir para "alternar loop timer", você DEVE chamar alternar_loop_timer
- NUNCA diga que fez algo se você não chamou a função correspondente!
- Se você NÃO CONSEGUIU executar a ação (porque não chamou a função), diga claramente: "Desculpe, não consegui executar essa ação. Pode tentar de novo?"

📝 CRIAÇÃO DE METAS - FLUXO IMPORTANTE:
Quando o usuário pedir para criar metas/tarefas:
1. PRIMEIRO: Liste as metas que você vai criar de forma clara e amigável
2. AGUARDE a confirmação do usuário (se ele concordar ou pedir alterações)
3. SÓ ENTÃO: Use a função criar_tarefa para cada meta
4. SEMPRE explique o que você fez após executar as funções

EXEMPLO:
Usuário: "adicione a meta estudar 7 dias"
Você: "📝 Vou criar a seguinte meta:
- Estudar 7 dias

Deseja que eu adicione? Posso ajustar se necessário!"

[APÓS CONFIRMAÇÃO, VOCÊ USA criar_tarefa E DIZ:]
"✅ Perfeito! Adicionei a meta 'Estudar 7 dias' na sua lista de Metas. Boa sorte com seus estudos! 💪"

🗑️ EXCLUSÃO DE METAS:
Quando o usuário pedir para excluir/remover/apagar uma meta:
1. Identifique qual meta deve ser excluída (pelo nome que ele mencionar)
2. Use a função excluir_tarefa com o título da meta
3. Confirme a exclusão ao usuário

EXEMPLO:
Usuário: "exclua a meta estudar 7 dias"
Você: [CHAMA excluir_tarefa com titulo_ou_id="estudar 7 dias"]
"✅ Meta 'Estudar 7 dias' foi removida com sucesso!"

📅 CRIAÇÃO DE CRONOGRAMAS - FLUXO IMPORTANTE:
1. MOSTRE o cronograma detalhado completo no chat primeiro (em formato de tabela ou lista bonita).
2. PERGUNTE se o usuário quer salvar, adicionar ou modificar.
3. INTERPRETE CONFIRMAÇÕES: Se o usuário disser "ótimo", "legal", "pode salvar", "adicione", "gostei", "sim", "ok", "salve", "mande para a aba" -> VOCÊ DEVE IMEDIATAMENTE CHAMAR A FUNÇÃO criar_cronograma.
4. NÃO PERGUNTE NOVAMENTE se ele já confirmou. SALVE IMEDIATAMENTE.
5. O cronograma SÓ VAI PARA A ABA se você chamar a função criar_cronograma.
6. APÓS CHAMAR A FUNÇÃO, responda com um emoji de confirmação (ex: "✅ Cronograma salvo com sucesso na aba Cronogramas!").

🔄 ATUALIZAÇÃO DE CRONOGRAMAS:
- Se o usuário pedir para "adicionar" algo a um cronograma que JÁ EXISTE ou que acabou de ser criado, use a função **adicionar_atividades_cronograma**.
- NÃO crie um novo cronograma do zero se o usuário só quer adicionar itens.

🎯 KANBAN:
Quando o usuário pedir para adicionar algo ao Kanban:
1. Use criar_item_kanban especificando a coluna correta
2. Coluna "todo" = "A Fazer"
3. Coluna "in-progress" = "Em Progresso"  
4. Coluna "done" = "Concluído"

⏰ TIMER DE FOCO:
Quando o usuário pedir para iniciar, pausar ou parar o timer de foco:
1. Use as funções correspondentes (iniciar_timer, definir_modo_timer, etc.)
2. Explique o que você fez após executar as funções

⚠️ REGRAS CRÍTICAS DO TIMER:
1. As funções de timer (iniciar_timer, definir_modo_timer, etc.) JÁ ABREM a janela do timer automaticamente. NÃO use navegar_para_pagina para isso.
2. Se o usuário pedir "Iniciar Pomodoro" (ou outro modo), você DEVE chamar definir_modo_timer com o parâmetro iniciar=true.
   - Exemplo: definir_modo_timer(modo="pomodoro", iniciar=true)
3. Se o usuário pedir apenas "Iniciar timer" (sem especificar modo), chame apenas iniciar_timer().
4. COMANDOS COMPOSTOS: Se o usuário pedir "Pause o pomodoro e inicie uma pausa curta", você NÃO precisa chamar pausar_timer. Apenas chame definir_modo_timer(modo="short", iniciar=true). A mudança de modo já reinicia o timer no novo estado.
5. VERDADE: Se você não chamou a função, NÃO diga que fez. Se o usuário pediu algo complexo e você só fez metade, diga o que fez e o que faltou.

⚠️ REGRA CRÍTICA DE COMUNICAÇÃO:
NUNCA responda apenas com palavras curtas como "Pronto!", "Ok!", "Feito!".
SEMPRE:
- Explique o que você fez ou vai fazer
- Seja amigável e conversacional
- Dê contexto adicional quando relevante
- Faça perguntas para entender melhor o usuário
- Sugira próximos passos quando apropriado
- SE VOCÊ EXECUTOU UMA AÇÃO (chamou uma tool), SEMPRE inclua um emoji de confirmação na sua resposta textual (ex: ✅, 🚀, 📝).

EXEMPLOS DE RESPOSTAS RUINS ❌:
- "Pronto!"
- "Ok!"
- "Feito!"
- [Resposta vazia]

EXEMPLOS DE RESPOSTAS BOAS ✅:
- "✅ Meta adicionada com sucesso! Você pode encontrá-la na aba Metas. Precisa de mais alguma coisa?"
- "Perfeito! Criei o cronograma de estudos para você. Quer que eu faça algum ajuste nos horários?"
- "Entendi! Vou te ajudar com isso. Pode me dar mais detalhes sobre..."

💡 FILOSOFIA:
Você é conversacional, prestativo e sempre explica suas ações. Seja útil em TUDO que o usuário pedir.

Responda sempre em português do Brasil de forma amigável, clara e natural. Seja criativo e prestativo!`

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] API /api/chat called")

    const body = await request.json()
    const { message, conversationHistory = [], context, image } = body

    console.log("[v0] Request body:", { message, hasImage: !!image, hasContext: !!context })

    if (!GEMINI_API_KEY) {
      console.error("[v0] GEMINI_API_KEY not configured")
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 })
    }

    // Build context
    let dynamicSystemInstruction = systemInstruction

    if (context) {
      const tasksList = context.tasks?.length
        ? context.tasks.map((t: any) => `- ${t.completed ? "✅" : "⏳"} ${t.title}`).join("\n")
        : "Nenhuma meta cadastrada."

      const kanbanList = context.kanbanTasks?.length
        ? context.kanbanTasks
          .map(
            (k: any) =>
              `- ${k.title} (${k.column === "todo" ? "A Fazer" : k.column === "in-progress" ? "Em Progresso" : "Concluído"})`,
          )
          .join("\n")
        : "Nenhum item no Kanban."

      const schedulesList = context.schedules?.length
        ? context.schedules.map((s: any) => `- ${s.title} (${s.activities?.length || 0} atividades)`).join("\n")
        : "Nenhum cronograma cadastrado."

      dynamicSystemInstruction += `\n\n📊 CONTEXTO ATUAL DO USUÁRIO:\n\n**METAS ATUAIS:**\n${tasksList}\n\n**ITEMS NO KANBAN:**\n${kanbanList}\n\n**CRONOGRAMAS ATUAIS:**\n${schedulesList}`
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: dynamicSystemInstruction,
      tools: tools as any,
    })

    // Build history
    const sanitizedHistory = []
    let lastRole = null

    for (const msg of conversationHistory) {
      const role = msg.role === "user" ? "user" : "model"

      // Skip if same role as last message (Gemini requires alternating roles)
      if (role === lastRole) continue

      // Skip if content is empty
      if (!msg.content || !msg.content.trim()) continue

      sanitizedHistory.push({
        role,
        parts: [{ text: msg.content }],
      })
      lastRole = role
    }

    while (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== "user") {
      sanitizedHistory.shift()
    }

    // Ensure history doesn't end with user (since we are about to send a user message)
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === "user") {
      sanitizedHistory.pop()
    }

    console.log("[v0] Starting chat with history length:", sanitizedHistory.length)

    const chat = model.startChat({ history: sanitizedHistory })

    // Build current message parts
    const userParts: any[] = [{ text: message }]
    if (image) {
      userParts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      })
    }

    console.log("[v0] Sending message to Gemini")
    const result = await chat.sendMessage(userParts)
    const response = result.response

    console.log("[v0] Received response from Gemini")

    // Process function calls
    const actions: any[] = []
    let textResponse = ""

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          textResponse += part.text
        }
      }
    }

    // Sometimes the model outputs "tool_code print(...)" instead of calling the tool
    if (textResponse.includes("tool_code") || textResponse.includes("default_api.")) {
      console.warn("[v0] Detected tool_code leakage in response, cleaning it up")

      // Remove lines containing tool_code or default_api
      textResponse = textResponse
        .split("\n")
        .filter((line) => !line.includes("tool_code") && !line.includes("default_api."))
        .join("\n")
        .trim()

      // If the response became empty or was just the code, and we have no actions,
      // we should probably tell the user something went wrong but we are fixing it
      if (!textResponse && actions.length === 0) {
        textResponse = "Desculpe, tive um pequeno erro técnico ao processar seu pedido. Tente novamente, por favor."
      }
    }

    for (const part of response.functionCalls() || []) {
      console.log("[v0] Function call:", part.name)
      const fc = part
      let actionType = ""
      const args: any = { ...fc.args }

      // Map function names to action types
      if (fc.name === "navegar_para_pagina") {
        actionType = "openPage"
        args.page = args.pagina
        delete args.pagina
      } else if (fc.name === "criar_tarefa") {
        actionType = "createTask"
        args.title = args.titulo
        delete args.titulo
      } else if (fc.name === "excluir_tarefa") {
        actionType = "deleteTask"
        args.titleOrId = args.titulo_ou_id
        delete args.titulo_ou_id
      } else if (fc.name === "criar_item_kanban") {
        actionType = "createKanbanItem"
        args.title = args.titulo
        args.column = args.coluna
        delete args.titulo
        delete args.coluna
      } else if (fc.name === "mover_item_kanban") {
        actionType = "moveKanbanItem"
        args.titleOrId = args.titulo_ou_id
        args.newColumn = args.nova_coluna
        delete args.titulo_ou_id
        delete args.nova_coluna
      } else if (fc.name === "criar_cronograma") {
        actionType = "createSchedule"
        const sanitizedActivities = (args.atividades || []).map((activity: any) => ({
          title: activity.titulo || activity.title || "Atividade sem título",
          description: activity.descricao || activity.description || "",
          day_of_week: typeof activity.dia_da_semana === "number" ? activity.dia_da_semana : 0,
          start_time: activity.hora_inicio || activity.start_time || "09:00",
          end_time: activity.hora_fim || activity.end_time || "10:00",
        }))

        args.schedule = {
          title: args.titulo || "Novo Cronograma",
          description: args.descricao || "",
          activities: sanitizedActivities,
        }
        delete args.titulo
        delete args.descricao
        delete args.atividades
      } else if (fc.name === "adicionar_atividades_cronograma") {
        actionType = "addActivitiesToSchedule"
        const sanitizedActivities = (args.atividades || []).map((activity: any) => ({
          title: activity.titulo || activity.title || "Atividade sem título",
          description: activity.descricao || activity.description || "",
          day_of_week: typeof activity.dia_da_semana === "number" ? activity.dia_da_semana : 0,
          start_time: activity.hora_inicio || activity.start_time || "09:00",
          end_time: activity.hora_fim || activity.end_time || "10:00",
        }))

        args.activities = sanitizedActivities
        delete args.atividades
      } else if (fc.name === "configurar_alarme_procrastinacao") {
        actionType = "setAlarm"
        args.enabled = args.ativado
        args.minutes = args.tempo
        delete args.ativado
        delete args.tempo
      } else if (fc.name === "criar_alarme_manual") {
        actionType = "createManualAlarm"
        args.title = args.titulo
        args.minutes = args.tempo
        delete args.titulo
        delete args.tempo
      } else if (fc.name === "iniciar_timer") {
        actionType = "startTimer"
        args.minutes = args.minutos
        delete args.minutos
      } else if (fc.name === "pausar_timer") {
        actionType = "pauseTimer"
      } else if (fc.name === "parar_timer") {
        actionType = "stopTimer"
      } else if (fc.name === "definir_modo_timer") {
        actionType = "setTimerMode"
        args.mode = args.modo
        args.start = args.iniciar || false
        delete args.modo
        delete args.iniciar
      } else if (fc.name === "alternar_loop_timer") {
        actionType = "toggleTimerLoop"
        args.enabled = args.ativado
        delete args.ativado
      }

      if (actionType) {
        actions.push({
          type: actionType,
          ...args,
        })
      }
    }

    if (!textResponse.trim() && actions.length > 0) {
      textResponse = "✅ Ação realizada com sucesso!"
    } else if (!textResponse.trim() && actions.length === 0) {
      // Fallback for completely empty responses (should be rare with Gemini)
      textResponse = "Desculpe, não entendi. Poderia repetir?"
    }

    return NextResponse.json({
      message: textResponse,
      actions: actions,
    })
  } catch (error: any) {
    console.error("[v0] Error in /api/chat:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
