/*!
 * PromptForge — affinage optionnel par une IA (clé API fournie par l'utilisateur).
 *
 * Le site fonctionne entièrement sans cette fonction : le moteur local produit
 * déjà le prompt. Ce module ne sert qu'à une passe de relecture supplémentaire.
 *
 * La requête part directement du navigateur vers le fournisseur choisi. Elle
 * n'aboutit que si celui-ci accepte les requêtes d'origine navigateur (CORS) ;
 * sinon l'erreur est remontée telle quelle à l'utilisateur.
 *
 * Avertissement repris de la documentation Anthropic : une clé utilisée côté
 * navigateur est exposée à toute personne ayant accès à la page ou à l'appareil.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PF = root.PF || {};
  root.PF.ai = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PROVIDERS = {
    anthropic: {
      label: 'Anthropic (Claude)',
      endpoint: 'https://api.anthropic.com/v1/messages',
      defaultModel: 'claude-opus-5',
      keyHint: 'sk-ant-…'
    },
    openai: {
      label: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: '',
      keyHint: 'sk-…'
    },
    custom: {
      label: 'API compatible OpenAI',
      endpoint: '',
      defaultModel: '',
      keyHint: ''
    }
  };

  var SYSTEM = {
    fr: 'Tu es un ingénieur prompt. On te donne un prompt déjà structuré. Tu le renvoies amélioré : plus précis, plus court là où c\'est possible, sans rien perdre d\'essentiel. Tu conserves exactement la même structure de sections et la même langue. Tu n\'ajoutes aucun commentaire, aucune explication et aucun bloc de code autour : tu renvoies uniquement le prompt amélioré.',
    en: 'You are a prompt engineer. You are given an already structured prompt. Return it improved: sharper, shorter where possible, losing nothing essential. Keep exactly the same section structure and the same language. Add no commentary, no explanation and no surrounding code fence: return only the improved prompt.'
  };

  var USER = {
    fr: 'Voici le prompt à améliorer. Renvoie uniquement la version améliorée.\n\n',
    en: 'Here is the prompt to improve. Return only the improved version.\n\n'
  };

  function buildRequest(provider, opts) {
    var p = PROVIDERS[provider] || PROVIDERS.custom;
    var endpoint = (provider === 'custom' ? opts.endpoint : p.endpoint) || '';
    var lang = opts.lang === 'en' ? 'en' : 'fr';

    if (provider === 'anthropic') {
      return {
        url: endpoint,
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': opts.key,
            'anthropic-version': '2023-06-01',
            // Autorise explicitement l'appel depuis une page web.
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: opts.model || p.defaultModel,
            max_tokens: 16000,
            system: SYSTEM[lang],
            messages: [{ role: 'user', content: USER[lang] + opts.prompt }]
          })
        }
      };
    }

    // OpenAI et toute API qui en reprend le format de requête.
    return {
      url: endpoint,
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + opts.key
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: 'system', content: SYSTEM[lang] },
            { role: 'user', content: USER[lang] + opts.prompt }
          ]
        })
      }
    };
  }

  function extractText(provider, data) {
    if (provider === 'anthropic') {
      if (!data || !Array.isArray(data.content)) return '';
      return data.content
        .filter(function (b) { return b && b.type === 'text'; })
        .map(function (b) { return b.text; })
        .join('\n')
        .trim();
    }
    if (data && Array.isArray(data.choices) && data.choices[0] && data.choices[0].message) {
      return String(data.choices[0].message.content || '').trim();
    }
    return '';
  }

  function describeError(status, data, fallback) {
    var msg = '';
    if (data && data.error) msg = data.error.message || data.error.type || '';
    if (!msg && typeof data === 'string') msg = data.slice(0, 300);
    if (!msg) msg = fallback || '';
    return (status ? 'HTTP ' + status + ' — ' : '') + (msg || 'erreur inconnue');
  }

  /**
   * @param {{provider:string,key:string,model:string,endpoint?:string,prompt:string,lang:string}} opts
   * @returns {Promise<string>} le prompt affiné
   */
  function refine(opts) {
    var provider = PROVIDERS[opts.provider] ? opts.provider : 'custom';
    if (!opts.key) return Promise.reject(new Error('missing_key'));
    if (!opts.prompt) return Promise.reject(new Error('missing_prompt'));

    var req = buildRequest(provider, opts);
    if (!req.url) return Promise.reject(new Error('missing_endpoint'));
    if (provider !== 'anthropic' && !opts.model) return Promise.reject(new Error('missing_model'));

    return fetch(req.url, req.init).then(function (res) {
      return res.text().then(function (raw) {
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { data = raw; }
        if (!res.ok) throw new Error(describeError(res.status, data, res.statusText));
        var text = extractText(provider, data);
        if (!text) throw new Error(describeError(0, data, 'réponse vide'));
        return text;
      });
    }, function (networkError) {
      // Un échec CORS remonte ici sans détail exploitable côté navigateur.
      throw new Error((networkError && networkError.message ? networkError.message + ' — ' : '') +
        'la requête n\'a pas abouti (réseau, CORS ou clé refusée).');
    });
  }

  return { PROVIDERS: PROVIDERS, refine: refine, buildRequest: buildRequest, extractText: extractText };
});
