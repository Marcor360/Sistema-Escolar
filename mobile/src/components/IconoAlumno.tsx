import { Image } from 'react-native';
import menu from '../assets/icons/menu.png';
import close from '../assets/icons/close.png';
import grid from '../assets/icons/grid.png';
import aula from '../assets/icons/aula.png';
import calendar from '../assets/icons/calendar.png';
import document from '../assets/icons/document.png';
import wallet from '../assets/icons/wallet.png';
import chart from '../assets/icons/chart.png';
import user from '../assets/icons/user.png';
import arrow from '../assets/icons/arrow.png';
import chevron from '../assets/icons/chevron.png';
import logout from '../assets/icons/logout.png';
import bell from '../assets/icons/bell.png';
import check from '../assets/icons/check.png';
import book from '../assets/icons/book.png';
const iconos = {
  menu,
  close,
  grid,
  aula,
  calendar,
  document,
  wallet,
  chart,
  user,
  arrow,
  chevron,
  logout,
  bell,
  check,
  book,
};
export type NombreIconoAlumno = keyof typeof iconos;
export function IconoAlumno({ nombre, color = '#20333D', tamano = 22 }: { nombre: NombreIconoAlumno; color?: string; tamano?: number }) {
  return <Image accessible={false} source={iconos[nombre]} style={{ width: tamano, height: tamano, tintColor: color }} />;
}
