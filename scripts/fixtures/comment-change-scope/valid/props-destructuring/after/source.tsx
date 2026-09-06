type TitleProps = { title: string };

export function Title(props: TitleProps) {
  const { title } = props;
  return <h1>{title}</h1>;
}
