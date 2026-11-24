// Tampons bornés pour les effets visuels (trous de balle, taches de sang…)

// Ajoute element à la fin ; si la liste dépasse max, retire et renvoie le plus ancien, sinon null
export function ajouterBorne(liste, element, max) {
  liste.push(element);
  return liste.length > max ? liste.shift() : null;
}

// Nombre de particules selon le niveau de qualité (facteur), au moins 1
export function nombreParticules(base, facteur) {
  return Math.max(1, Math.round(base * facteur));
}
