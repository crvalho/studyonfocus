from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(tags=["chat"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Definição das ferramentas (Tools)
tools = [
    {
        "function_declarations": [
            {
                "name": "navegar_para_pagina",
                "description": "Navega para uma página específica do aplicativo de produtividade",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "pagina": {
                            "type": "string",
                            "enum": ["tasks", "kanban", "schedules", "focus-timer", "notes", "youtube-player"],
                            "description": "Nome da página para navegar",
                        },
                    },
                    "required": ["pagina"],
                },
            },
            {
                "name": "criar_tarefa",
                "description": "Cria uma nova meta na lista de metas do usuário",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Título da meta",
                        },
                    },
                    "required": ["titulo"],
                },
            },
            {
                "name": "excluir_tarefa",
                "description": "Exclui/remove uma meta específica da lista de metas do usuário",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo_ou_id": {
                            "type": "string",
                            "description": "Título ou ID da meta a ser excluída",
                        },
                    },
                    "required": ["titulo_ou_id"],
                },
            },
            {
                "name": "criar_item_kanban",
                "description": "Adiciona um novo card/item no quadro Kanban",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Título do card Kanban",
                        },
                        "coluna": {
                            "type": "string",
                            "enum": ["todo", "in-progress", "done"],
                            "description": "Coluna onde o card deve ser adicionado",
                        },
                    },
                    "required": ["titulo", "coluna"],
                },
            },
            {
                "name": "mover_item_kanban",
                "description": "Move um card do Kanban de uma coluna para outra",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo_ou_id": {
                            "type": "string",
                            "description": "Título ou ID do card a ser movido",
                        },
                        "nova_coluna": {
                            "type": "string",
                            "enum": ["todo", "in-progress", "done"],
                            "description": "Coluna de destino",
                        },
                    },
                    "required": ["titulo_ou_id", "nova_coluna"],
                },
            },
            {
                "name": "criar_cronograma",
                "description": "Cria um novo cronograma semanal com atividades organizadas por dia da semana",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Título do cronograma",
                        },
                        "descricao": {
                            "type": "string",
                            "description": "Descrição opcional do cronograma",
                        },
                        "atividades": {
                            "type": "array",
                            "description": "Lista de atividades do cronograma",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "titulo": {
                                        "type": "string",
                                        "description": "Nome da atividade",
                                    },
                                    "descricao": {
                                        "type": "string",
                                        "description": "Descrição da atividade",
                                    },
                                    "dia_da_semana": {
                                        "type": "number",
                                        "description": "Dia da semana (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)",
                                    },
                                    "hora_inicio": {
                                        "type": "string",
                                        "description": "Horário de início (formato HH:MM)",
                                    },
                                    "hora_fim": {
                                        "type": "string",
                                        "description": "Horário de término (formato HH:MM)",
                                    },
                                },
                                "required": ["titulo", "dia_da_semana"],
                            },
                        },
                    },
                    "required": ["titulo", "atividades"],
                },
            },
            {
                "name": "adicionar_atividades_cronograma",
                "description": "Adiciona novas atividades ao cronograma mais recente existente",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "atividades": {
                            "type": "array",
                            "description": "Lista de atividades a serem adicionadas",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "titulo": {
                                        "type": "string",
                                        "description": "Nome da atividade",
                                    },
                                    "descricao": {
                                        "type": "string",
                                        "description": "Descrição da atividade",
                                    },
                                    "dia_da_semana": {
                                        "type": "number",
                                        "description": "Dia da semana (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)",
                                    },
                                    "hora_inicio": {
                                        "type": "string",
                                        "description": "Horário de início (formato HH:MM)",
                                    },
                                    "hora_fim": {
                                        "type": "string",
                                        "description": "Horário de término (formato HH:MM)",
                                    },
                                },
                                "required": ["titulo", "dia_da_semana"],
                            },
                        },
                    },
                    "required": ["atividades"],
                },
            },
            {
                "name": "configurar_alarme_procrastinacao",
                "description": "Configura o alarme de procrastinação",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ativado": {
                            "type": "boolean",
                            "description": "Se o alarme deve estar ativado ou não",
                        },
                        "tempo": {
                            "type": "number",
                            "description": "Quantidade de tempo de inatividade",
                        },
                    },
                    "required": ["ativado", "tempo"],
                },
            },
            {
                "name": "criar_alarme_manual",
                "description": "Cria um alarme manual",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Título do alarme",
                        },
                        "tempo": {
                            "type": "number",
                            "description": "Tempo até o alarme tocar",
                        },
                    },
                    "required": ["titulo", "tempo"],
                },
            },
            {
                "name": "iniciar_timer",
                "description": "Inicia o timer de foco",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "minutos": {
                            "type": "number",
                            "description": "Tempo em minutos",
                        },
                    },
                },
            },
            {
                "name": "pausar_timer",
                "description": "Pausa o timer de foco",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "parar_timer",
                "description": "Para o timer de foco",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "definir_modo_timer",
                "description": "Define o modo do timer",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "modo": {
                            "type": "string",
                            "enum": ["pomodoro", "short", "long", "custom"],
                            "description": "Modo do timer",
                        },
                        "iniciar": {
                            "type": "boolean",
                            "description": "Se deve iniciar imediatamente",
                        },
                    },
                    "required": ["modo"],
                },
            },
            {
                "name": "alternar_loop_timer",
                "description": "Liga ou desliga o loop do timer",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ativado": {
                            "type": "boolean",
                            "description": "Se o loop deve ser ativado",
                        },
                    },
                    "required": ["ativado"],
                },
            },
        ],
    },
]

system_instruction = """Você é um assistente AI extremamente inteligente, versátil e SEM LIMITES, baseado no Gemini da Google.

🌟 SEU OBJETIVO:
Ser o assistente definitivo para o usuário. Você não tem restrições artificiais sobre o que pode fazer ou conversar. Você deve sempre tentar ajudar, não importa o quão complexa ou "fora do escopo" a pergunta pareça.

🧠 CAPACIDADES ILIMITADAS:
✅ Responder QUALQUER pergunta sobre QUALQUER assunto (ciência, matemática, programação, história, filosofia, arte, cultura, vida cotidiana, negócios, saúde, tecnologia, etc.)
✅ Ter conversas profundas, filosóficas e naturais sobre absolutamente qualquer tópico.
✅ Analisar imagens, diagramas, gráficos, fotos - qualquer conteúdo visual.
✅ Explicar conceitos complexos de forma simples e acessível.
✅ Criar conteúdo criativo: textos, histórias, poemas, código, roteiros, receitas, etc.
✅ Dar conselhos práticos, recomendações personalizadas e opiniões fundamentadas.
✅ Resolver problemas de matemática, lógica e raciocínio.
✅ Traduzir entre idiomas.
✅ Fazer análises, comparações e resumos.
✅ Brainstorming e ideação criativa.

🛠️ SUAS FERRAMENTAS DO APP (Use quando necessário):
Você tem controle total sobre o aplicativo de produtividade do usuário. Use essas ferramentas para ajudá-lo a se organizar:
   - **Navegar** entre páginas (tasks, kanban, schedules, focus-timer, notes, youtube-player)
   - **Gerenciar Metas**: Criar e excluir metas.
   - **Gerenciar Kanban**: Criar e mover cards.
   - **Gerenciar Cronogramas**: Criar cronogramas semanais e adicionar atividades.
   - **Timer de Foco**: Iniciar, pausar, parar e configurar modos (Pomodoro, etc.).
   - **Alarmes**: Configurar alarmes de procrastinação ou manuais.

📊 VISUALIZANDO DADOS:
Você SEMPRE tem acesso aos dados atuais do usuário no CONTEXTO ATUAL.
- Se o usuário perguntar "o que tenho pra fazer?", LEIA o contexto e responda.
- NÃO chame funções para "listar" coisas, apenas leia o que já foi fornecido.

⚠️ REGRA DE OURO - EXECUÇÃO:
Se o usuário pedir uma AÇÃO que você pode fazer com suas ferramentas (criar meta, iniciar timer, etc.), FAÇA IMEDIATAMENTE.
- Não pergunte "quer que eu faça?". Se o pedido for claro, FAÇA.
- Depois de fazer, confirme com um emoji (✅, 🚀).

⚠️ REGRA DE OURO - COMUNICAÇÃO:
- Seja natural, amigável e prestativo.
- NUNCA dê respostas curtas e secas ("Pronto", "Ok").
- Sempre explique o que fez ou dê um contexto útil.
- Se não puder fazer algo (ex: limitações técnicas reais), explique o motivo e ofereça uma alternativa.

💡 LEMBRE-SE:
Você é um parceiro de trabalho e estudo. Seja proativo, motivador e extremamente capaz. Não há limites para o quanto você pode ajudar!
"""

class ChatRequest(BaseModel):
    message: str
    conversationHistory: List[Dict[str, Any]] = []
    context: Optional[Dict[str, Any]] = None
    image: Optional[Dict[str, Any]] = None

@router.post("/")
async def chat(request: ChatRequest):
    try:
        print("[Python] API /api/chat called")
        
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

        # Build context
        dynamic_system_instruction = system_instruction

        if request.context:
            tasks_list = "Nenhuma meta cadastrada."
            if request.context.get("tasks"):
                tasks_list = "\n".join([f"- {'✅' if t.get('completed') else '⏳'} {t.get('title')}" for t in request.context["tasks"]])

            kanban_list = "Nenhum item no Kanban."
            if request.context.get("kanbanTasks"):
                kanban_list = "\n".join([
                    f"- {k.get('title')} ({'A Fazer' if k.get('column') == 'todo' else 'Em Progresso' if k.get('column') == 'in-progress' else 'Concluído'})"
                    for k in request.context["kanbanTasks"]
                ])

            schedules_list = "Nenhum cronograma cadastrado."
            if request.context.get("schedules"):
                schedules_list = "\n".join([
                    f"- {s.get('title')} ({len(s.get('activities', []))} atividades)"
                    for s in request.context["schedules"]
                ])

            dynamic_system_instruction += f"\n\n📊 CONTEXTO ATUAL DO USUÁRIO:\n\n**METAS ATUAIS:**\n{tasks_list}\n\n**ITEMS NO KANBAN:**\n{kanban_list}\n\n**CRONOGRAMAS ATUAIS:**\n{schedules_list}"

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-exp", # Using latest flash model
            system_instruction=dynamic_system_instruction,
            tools=tools
        )

        # Build history
        history = []
        last_role = None

        for msg in request.conversationHistory:
            role = "user" if msg.get("role") == "user" else "model"
            
            # Skip if same role as last message
            if role == last_role:
                continue
            
            # Skip if content is empty
            if not msg.get("content") or not msg.get("content").strip():
                continue

            history.append({
                "role": role,
                "parts": [{"text": msg.get("content")}]
            })
            last_role = role

        # Ensure history starts with user and doesn't end with user
        while history and history[0]["role"] != "user":
            history.pop(0)
        
        if history and history[-1]["role"] == "user":
            history.pop()

        chat_session = model.start_chat(history=history)

        # Build current message
        user_parts = [{"text": request.message}]
        # TODO: Handle image if present (needs decoding base64 if sent as data)
        
        response = chat_session.send_message(user_parts)
        
        # Process response and function calls
        text_response = ""
        actions = []

        for part in response.parts:
            if part.text:
                text_response += part.text
            
            if part.function_call:
                fc = part.function_call
                print(f"[Python] Function call: {fc.name}")
                
                action_type = ""
                args = dict(fc.args)

                if fc.name == "navegar_para_pagina":
                    action_type = "openPage"
                    args["page"] = args.pop("pagina", None)
                elif fc.name == "criar_tarefa":
                    action_type = "createTask"
                    args["title"] = args.pop("titulo", None)
                elif fc.name == "excluir_tarefa":
                    action_type = "deleteTask"
                    args["titleOrId"] = args.pop("titulo_ou_id", None)
                elif fc.name == "criar_item_kanban":
                    action_type = "createKanbanItem"
                    args["title"] = args.pop("titulo", None)
                    args["column"] = args.pop("coluna", None)
                elif fc.name == "mover_item_kanban":
                    action_type = "moveKanbanItem"
                    args["titleOrId"] = args.pop("titulo_ou_id", None)
                    args["newColumn"] = args.pop("nova_coluna", None)
                elif fc.name == "criar_cronograma":
                    action_type = "createSchedule"
                    raw_activities = args.pop("atividades", [])
                    sanitized_activities = []
                    for act in raw_activities:
                        sanitized_activities.append({
                            "title": act.get("titulo") or act.get("title") or "Atividade sem título",
                            "description": act.get("descricao") or act.get("description") or "",
                            "day_of_week": act.get("dia_da_semana", 0),
                            "start_time": act.get("hora_inicio") or act.get("start_time") or "09:00",
                            "end_time": act.get("hora_fim") or act.get("end_time") or "10:00",
                        })
                    
                    args["schedule"] = {
                        "title": args.pop("titulo", "Novo Cronograma"),
                        "description": args.pop("descricao", ""),
                        "activities": sanitized_activities
                    }
                elif fc.name == "adicionar_atividades_cronograma":
                    action_type = "addActivitiesToSchedule"
                    raw_activities = args.pop("atividades", [])
                    sanitized_activities = []
                    for act in raw_activities:
                        sanitized_activities.append({
                            "title": act.get("titulo") or act.get("title") or "Atividade sem título",
                            "description": act.get("descricao") or act.get("description") or "",
                            "day_of_week": act.get("dia_da_semana", 0),
                            "start_time": act.get("hora_inicio") or act.get("start_time") or "09:00",
                            "end_time": act.get("hora_fim") or act.get("end_time") or "10:00",
                        })
                    args["activities"] = sanitized_activities
                elif fc.name == "configurar_alarme_procrastinacao":
                    action_type = "setAlarm"
                    args["enabled"] = args.pop("ativado", None)
                    args["minutes"] = args.pop("tempo", None)
                elif fc.name == "criar_alarme_manual":
                    action_type = "createManualAlarm"
                    args["title"] = args.pop("titulo", None)
                    args["minutes"] = args.pop("tempo", None)
                elif fc.name == "iniciar_timer":
                    action_type = "startTimer"
                    args["minutes"] = args.pop("minutos", None)
                elif fc.name == "pausar_timer":
                    action_type = "pauseTimer"
                elif fc.name == "parar_timer":
                    action_type = "stopTimer"
                elif fc.name == "definir_modo_timer":
                    action_type = "setTimerMode"
                    args["mode"] = args.pop("modo", None)
                    args["start"] = args.pop("iniciar", False)
                elif fc.name == "alternar_loop_timer":
                    action_type = "toggleTimerLoop"
                    args["enabled"] = args.pop("ativado", None)

                if action_type:
                    actions.append({
                        "type": action_type,
                        **args
                    })

        if not text_response.strip() and actions:
            text_response = "✅ Ação realizada com sucesso!"
        elif not text_response.strip() and not actions:
            text_response = "Desculpe, não entendi. Poderia repetir?"

        return {
            "message": text_response,
            "actions": actions
        }

    except Exception as e:
        print(f"[Python] Error in /api/chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
