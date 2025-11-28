/**
 * Calculadora de Gastos - Script Principal
 * Gerencia cálculos financeiros e feedback ao usuário
 */

'use strict';

/* ==========================================================================
   Utilitários
   ========================================================================== */

/**
 * Cria uma função debounced que atrasa a execução
 * @param {Function} func - Função a ser executada
 * @param {number} delay - Delay em milissegundos
 * @returns {Function} Função debounced
 */
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * Converte string de valor para número
 * @param {string|number} valor - Valor a ser parseado
 * @returns {number} Valor numérico ou 0
 */
const parseValor = (valor) => {
  if (!valor) return 0;
  const normalizado = String(valor).replace(',', '.');
  const numero = parseFloat(normalizado);
  return Number.isNaN(numero) ? 0 : numero;
};

/**
 * Formata número para moeda brasileira
 * @param {number} valor - Valor numérico
 * @returns {string} Valor formatado (ex: "1.234,56")
 */
const formatarMoeda = (valor) => {
  return valor.toFixed(2).replace('.', ',');
};

/**
 * Formata número para exibição com prefixo R$
 * @param {number} valor - Valor numérico
 * @returns {string} Valor formatado (ex: "R$ 1.234,56")
 */
const formatarMoedaCompleta = (valor) => `R$ ${formatarMoeda(valor)}`;

/* ==========================================================================
   Dados
   ========================================================================== */

const CESTA_BASICA_POR_ESTADO = Object.freeze({
  AC: 631.08, AL: 592.25, AM: 633.25, AP: 679.09, BA: 606.39,
  CE: 686.78, DF: 717.65, ES: 746.22, GO: 720.57, MA: 643.31,
  MG: 716.53, MS: 777.28, MT: 794.77, PA: 664.31, PB: 609.94,
  PE: 608.03, PI: 646.72, PR: 761.77, RJ: 801.37, RN: 612.18,
  RO: 618.86, RR: 678.95, RS: 823.57, SC: 824.57, SE: 550.18,
  SP: 847.14, TO: 695.42
});

// Limites para alertas (percentuais da renda)
const LIMITES = Object.freeze({
  ALUGUEL_MAX: 0.33,
  CARTAO_MAX: 0.25,
  SOBRA_MIN_POR_PESSOA: 100,
  MESES_RESERVA: 3
});

/* ==========================================================================
   Classes CSS
   ========================================================================== */

const CSS_CLASSES = Object.freeze({
  HIDDEN: 'calculator__summary--hidden',
  VALUE_POSITIVE: 'summary-card__value--positive',
  VALUE_NEGATIVE: 'summary-card__value--negative'
});

/* ==========================================================================
   Módulo Principal
   ========================================================================== */

const CalculadoraGastos = (() => {
  // Cache de elementos DOM
  let elementos = {};

  /**
   * Inicializa o cache de elementos DOM
   */
  const inicializarElementos = () => {
    elementos = {
      apoioCard: document.getElementById('mensagens-de-apoio'),
      apoioContent: document.querySelector('#mensagens-de-apoio .summary-card__content'),
      formGastos: document.querySelector('.form--expenses'),
      formRenda: document.querySelector('.form--income'),
      stateSelect: document.querySelector('select[name="estado"]'),
      foodInput: document.querySelector('input[name="alimentacao"]'),
      incomeTotalInput: document.querySelector('input[name="renda-total"]'),
      expensesTotalInput: document.querySelector('input[name="despesas-totais"]'),
      summaryValue: document.querySelector('.summary-card__value'),
      familiaInput: document.querySelector('input[name="quantidade-familia"]')
    };
  };

  /**
   * Aplica máscara de centavos ao input
   * @param {HTMLInputElement} input - Elemento input
   */
  const aplicarMascaraCentavos = (input) => {
    input.addEventListener('input', () => {
      let valor = input.value.replace(/\D/g, '');
      if (valor.length < 3) {
        valor = valor.padStart(3, '0');
      }
      input.value = (parseInt(valor, 10) / 100).toFixed(2);
    });
  };

  /**
   * Exibe mensagens de apoio
   * @param {string} html - Conteúdo HTML das mensagens
   */
  const mostrarApoio = (html) => {
    const { apoioCard, apoioContent } = elementos;
    if (!apoioCard || !apoioContent) return;
    
    apoioCard.classList.remove(CSS_CLASSES.HIDDEN);
    apoioContent.innerHTML = html;
  };

  /**
   * Limpa mensagens de apoio
   */
  const limparApoio = () => {
    const { apoioCard, apoioContent } = elementos;
    if (!apoioCard || !apoioContent) return;
    
    apoioCard.classList.add(CSS_CLASSES.HIDDEN);
    apoioContent.innerHTML = '';
  };

  /**
   * Obtém valores atuais de renda e gastos
   * @returns {Object} Objeto com renda, gastos e sobra
   */
  const obterValoresAtuais = () => {
    const renda = parseValor(elementos.incomeTotalInput?.value);
    const gastos = parseValor(elementos.expensesTotalInput?.value);
    return { renda, gastos, sobra: renda - gastos };
  };

  /**
   * Atualiza exibição do valor restante
   */
  const atualizarSobra = () => {
    const { summaryValue } = elementos;
    if (!summaryValue) return;

    const { sobra } = obterValoresAtuais();
    summaryValue.textContent = formatarMoedaCompleta(sobra);
    
    // Usa CSS custom properties para cores
    summaryValue.style.color = sobra >= 0 
      ? 'var(--green-500)' 
      : 'var(--red-300)';
  };

  /**
   * Verifica se gasto com alimentação está abaixo da cesta básica
   * @returns {Object|null} Mensagem de alerta ou null
   */
  const verificarCestaBasica = () => {
    const { stateSelect, foodInput } = elementos;
    if (!stateSelect?.value || !foodInput) return null;

    const estado = stateSelect.value;
    const valorAlimentacao = parseValor(foodInput.value);
    const cestaNecessaria = CESTA_BASICA_POR_ESTADO[estado];

    if (!cestaNecessaria || valorAlimentacao <= 0) return null;

    if (valorAlimentacao < cestaNecessaria) {
      return {
        tipo: 'alerta',
        texto: `Seu gasto com alimentação está abaixo da cesta básica do estado (${formatarMoedaCompleta(cestaNecessaria)}).`
      };
    }
    return null;
  };

  /**
   * Gera mensagens de análise financeira
   * @returns {Array} Array de mensagens
   */
  const gerarMensagensAnalise = () => {
    const { formGastos, familiaInput } = elementos;
    const { renda, gastos, sobra } = obterValoresAtuais();
    const mensagens = [];

    // Análise de aluguel
    const aluguel = parseValor(formGastos?.querySelector('input[name="aluguel"]')?.value);
    if (renda > 0 && aluguel >= LIMITES.ALUGUEL_MAX * renda) {
      mensagens.push({
        tipo: 'alerta',
        texto: 'O valor do aluguel está muito alto para sua renda. Isso pode prejudicar seu orçamento.'
      });
    }

    // Análise de cartão
    const cartao = parseValor(formGastos?.querySelector('input[name="cartao"]')?.value);
    if (renda > 0 && cartao > LIMITES.CARTAO_MAX * renda) {
      mensagens.push({
        tipo: 'alerta',
        texto: 'O valor do cartão de crédito está muito alto para sua renda. Isso pode virar dívida perigosa.'
      });
    }

    // Análise por pessoa na família
    const pessoas = parseInt(familiaInput?.value, 10) || 1;
    if (renda > 0 && pessoas > 0) {
      const sobraPorPessoa = sobra / pessoas;
      
      if (sobraPorPessoa <= 0) {
        mensagens.push({
          tipo: 'alerta',
          texto: 'Você está gastando mais do que ganha. Cuidado!'
        });
      } else if (sobraPorPessoa < LIMITES.SOBRA_MIN_POR_PESSOA) {
        mensagens.push({
          tipo: 'alerta',
          texto: `O que sobra por pessoa está baixo: ${formatarMoedaCompleta(sobraPorPessoa)} por pessoa.`
        });
      } else {
        mensagens.push({
          tipo: 'sucesso',
          texto: `Sobra ${formatarMoedaCompleta(sobraPorPessoa)} por pessoa na família.`
        });
      }
    }

    // Análise de reserva de emergência
    if (gastos > 0) {
      const reservaIdeal = gastos * LIMITES.MESES_RESERVA;
      mensagens.push({
        tipo: 'info',
        texto: `Sua reserva de emergência deve ser de pelo menos ${formatarMoedaCompleta(reservaIdeal)} (${LIMITES.MESES_RESERVA}x seus gastos mensais).`
      });

      if (sobra > 0) {
        const mesesParaReserva = Math.ceil(reservaIdeal / sobra);
        mensagens.push({
          tipo: 'info',
          texto: `Se guardar ${formatarMoedaCompleta(sobra)} todo mês, você atinge a reserva em ${mesesParaReserva} meses.`
        });
      } else if (sobra < 0) {
        mensagens.push({
          tipo: 'alerta',
          texto: 'Você precisa gastar menos ou ganhar mais para conseguir fazer uma reserva.'
        });
      }
    }

    // Verifica cesta básica
    const cestaMsg = verificarCestaBasica();
    if (cestaMsg) {
      mensagens.push(cestaMsg);
    }

    return mensagens;
  };

  /**
   * Atualiza mensagens de apoio com análise financeira
   */
  const atualizarMensagensApoio = () => {
    const mensagens = gerarMensagensAnalise();

    if (mensagens.length === 0) {
      limparApoio();
      return;
    }

    const html = mensagens
      .map(({ tipo, texto }) => `<p class="mensagem-${tipo}">${texto}</p>`)
      .join('');
    
    mostrarApoio(html);
  };

  /**
   * Soma todos os gastos do formulário
   */
  const somarGastos = () => {
    const { formGastos, expensesTotalInput } = elementos;
    if (!formGastos || !expensesTotalInput) return;

    const inputs = formGastos.querySelectorAll('input[type="number"]:not([name="despesas-totais"])');
    const total = Array.from(inputs).reduce((acc, input) => acc + parseValor(input.value), 0);
    
    expensesTotalInput.value = total.toFixed(2);
    atualizarSobra();
    atualizarMensagensApoio();
  };

  /**
   * Soma toda a renda do formulário
   */
  const somarRenda = () => {
    const { formRenda, incomeTotalInput } = elementos;
    if (!formRenda || !incomeTotalInput) return;

    const inputs = formRenda.querySelectorAll(
      'input[type="number"]:not([name="renda-total"]):not([name="quantidade-familia"])'
    );
    const total = Array.from(inputs).reduce((acc, input) => acc + parseValor(input.value), 0);
    
    incomeTotalInput.value = total.toFixed(2);
    atualizarSobra();
    atualizarMensagensApoio();
  };

  /**
   * Configura listeners para inputs de um formulário
   * @param {HTMLFormElement} form - Formulário
   * @param {string} excludeSelector - Seletor para excluir
   * @param {Function} callback - Callback para eventos
   */
  const configurarInputListeners = (form, excludeSelector, callback) => {
    if (!form) return;

    const inputs = form.querySelectorAll(`input[type="number"]:not(${excludeSelector})`);
    inputs.forEach((input) => {
      if (input.closest('.form__field--currency')) {
        aplicarMascaraCentavos(input);
      }
      input.addEventListener('input', callback);
      input.addEventListener('change', callback);
    });
  };

  /**
   * Configura o select de estado
   */
  const configurarSelectEstado = () => {
    const { stateSelect, foodInput } = elementos;
    if (!stateSelect) return;

    stateSelect.addEventListener('change', () => {
      if (foodInput) {
        foodInput.disabled = !stateSelect.value;
        if (!stateSelect.value) {
          foodInput.value = '';
        }
      }
      atualizarMensagensApoio();
    });
  };

  /**
   * Configura o input de alimentação
   */
  const configurarInputAlimentacao = () => {
    const { foodInput } = elementos;
    if (!foodInput) return;

    foodInput.disabled = true;
    aplicarMascaraCentavos(foodInput);
    foodInput.addEventListener('input', debounce(atualizarMensagensApoio, 300));
  };

  /**
   * Configura o input de quantidade de família
   */
  const configurarInputFamilia = () => {
    const { familiaInput } = elementos;
    if (!familiaInput) return;

    familiaInput.addEventListener('input', atualizarMensagensApoio);
    familiaInput.addEventListener('change', atualizarMensagensApoio);
  };

  /**
   * Inicializa a calculadora
   */
  const inicializar = () => {
    inicializarElementos();

    // Configura formulário de gastos
    configurarInputListeners(
      elementos.formGastos,
      '[name="despesas-totais"]',
      somarGastos
    );

    // Configura formulário de renda
    configurarInputListeners(
      elementos.formRenda,
      '[name="renda-total"], [name="quantidade-familia"]',
      somarRenda
    );

    // Configura inputs especiais
    configurarSelectEstado();
    configurarInputAlimentacao();
    configurarInputFamilia();

    // Calcula valores iniciais
    somarGastos();
    somarRenda();
  };

  // API pública
  return { inicializar };
})();

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', CalculadoraGastos.inicializar);
