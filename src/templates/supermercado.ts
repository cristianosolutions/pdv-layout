import templateSource from './supermercado.json?raw';
import { parseProject } from '../utils/project';

export function supermercadoTemplate() {
  return parseProject(templateSource, ['1600x900']);
}
