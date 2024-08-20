const express = require('express');
const axios = require('axios');
const router = express.Router();
const llave = process.env.LLAVE;

// Función para generar un nombre, descripción y evaluación de factibilidad del proyecto basado en un prompt con reintento
async function generarProyecto(prompt, ubi, tamanoProyecto, model) {
  const maxRetries = 3;
  const retryDelay = 20000; // 20 segundos en milisegundos
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model,  // Usando gpt-4o-mini
          messages: [
            { role: "system", content: "Eres un asistente que genera nombres, descripciones, investiga la competencia, evalúa la factibilidad y estima costos de proyectos." },
            { role: "user", content: `Genera un nombre, una descripción, evalúa la factibilidad con un comentario si es factible o no, investiga la competencia e incluye una estimación de costos en dólares para un proyecto relacionado con: ${prompt} en la ubicación: ${ubi} en Ecuador. Asegúrate de incluir todas las secciones: Nombre del Proyecto, Descripción, Evaluación de Factibilidad, Competencia, y Costos Estimados.` }
          ],
          max_tokens: 1000  // Incrementa este valor para obtener respuestas más largas
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llave}`
          }
        }
      );
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.log(`Error de límite de cuota. Reintento ${attempt}/${maxRetries} en ${retryDelay / 1000} segundos...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));  // Esperar antes de reintentar
      } else {
        console.log(`Ocurrió un error inesperado: ${error}`);
        break;
      }
    }
  }
  return null;
}

// Función para procesar la respuesta generada
function procesarRespuesta(respuesta) {
  const lineas = respuesta.split('\n');
  let nombreProyecto = "";
  let descripcion = "";
  let evaluacionFactibilidad = "";
  let competencia = "";
  let costosEstimados = "";
  let nombreProyectoFlag = false;
  let descripcionFlag = false;
  let factibilidadFlag = false;
  let competenciaFlag = false;
  let costosFlag = false;

  for (let linea of lineas) {
    if (linea.toLowerCase().includes("nombre del proyecto")) {
      nombreProyecto = lineas[lineas.indexOf(linea) + 1].replace(/["*]/g, '').trim();
      nombreProyectoFlag = true;
    } else if (linea.toLowerCase().includes("descripción")) {
      descripcion = lineas[lineas.indexOf(linea) + 1].replace(/["*]/g, '').trim();
      descripcionFlag = true;
    } else if (descripcionFlag && !factibilidadFlag) {
      if (linea.toLowerCase().includes("evaluación de factibilidad")) {
        factibilidadFlag = true;
        descripcionFlag = false;
      } else {
        descripcion += " " + linea.replace(/["*]/g, '').trim();
      }
    } else if (factibilidadFlag && !competenciaFlag) {
      if (linea.toLowerCase().includes("competencia")) {
        competenciaFlag = true;
        factibilidadFlag = false;
      } else {
        evaluacionFactibilidad += " " + linea.replace(/["*]/g, '').trim();
      }
    } else if (competenciaFlag && !costosFlag) {
      if (linea.toLowerCase().includes("costos estimados")) {
        costosFlag = true;
        competenciaFlag = false;
      } else {
        competencia += linea.includes('*') ? '\n' + linea.replace(/[*]/g, '').trim() : ' ' + linea.replace(/["*]/g, '').trim();
      }
    } else if (costosFlag) {
      costosEstimados += linea.includes('*') ? '\n' + linea.replace(/[*]/g, '').trim() : ' ' + linea.replace(/["*]/g, '').trim();
    }
  }
  console.log(costosEstimados)
  return { 
    nombreProyecto: nombreProyecto.replace(/["*#]/g, '').trim(), 
    descripcion: descripcion.replace(/["*#]/g, '').trim(), 
    evaluacionFactibilidad: evaluacionFactibilidad.replace(/["*#]/g, '').trim(), 
    competencia: competencia.replace(/["*#]/g, '').trim(), 
    costosEstimados: costosEstimados.replace(/["*#]/g, '').trim() 
  };
}

// Endpoint para generar proyecto
router.post('/', async (req, res) => {
  const { prompt, ubicacion, model } = req.body;
  const ubi = "Provincia de " + ubicacion;
  const tamanoProyecto = "grande";
  const proyectoGenerado = await generarProyecto(prompt, ubi, tamanoProyecto, model);
  if (proyectoGenerado) {
    const { nombreProyecto, descripcion, evaluacionFactibilidad, competencia, costosEstimados } = procesarRespuesta(proyectoGenerado);
    const result = {
      "nombreProyecto": nombreProyecto,
      "descripcion": descripcion,
      "evaluacionFactibilidad": evaluacionFactibilidad,
      "competencia": competencia,
      "costosEstimados": costosEstimados
    };
    res.status(201).json(result);
  } else {
    res.status(500).json({ error: "No se pudo generar un nuevo proyecto. " + llave});
  }
});

module.exports = router;
