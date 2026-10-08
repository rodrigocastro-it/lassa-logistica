// Envolve uma rota async pra garantir que qualquer erro (exceção síncrona
// ou promise rejeitada) vire um next(err) tratado pelo error handler do
// Express, em vez de virar uma promise rejeitada sem dono — que em versões
// recentes do Node derruba o processo inteiro (é o que causava os "Erro
// 521" vistos no Cloudflare: o backend saía do ar até o Docker reiniciar).
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { asyncHandler };
