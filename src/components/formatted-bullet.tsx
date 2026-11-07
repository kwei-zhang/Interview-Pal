import Markdown from "react-markdown";
import styles from "./resume-bullet-editor.module.css";

const allowedElements = ["p", "strong", "em", "code", "br"];

export function FormattedBullet({text}: {text: string}) {
  return <div className={styles.formatted}><Markdown allowedElements={allowedElements} unwrapDisallowed>{text}</Markdown></div>;
}
