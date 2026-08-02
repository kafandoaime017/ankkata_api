// Évite les blocs try/catch répétés dans chaque controller : enveloppe un
// handler Express async et transmet toute exception à `next()`, où le
// middleware d'erreur central la traitera.
module.exports = function catchAsync(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
