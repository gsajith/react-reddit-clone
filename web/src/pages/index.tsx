import { withUrqlClient } from "next-urql";
import NavBar from "../components/NavBar";
import { usePostsQuery } from "../generated/graphql";
import { createUrqlClient } from "../utils/createUrqlClient";

const Index = () => {
  const [{ data }] = usePostsQuery();
  return (
    <>
      <NavBar />
      <div>Hello world</div>
      <br />
      {!data ? (
        <div>Loading...</div>
      ) : (
        data.posts.map((p) => <div key={p.id}>{p.title}</div>)
      )}
    </>
  );
};

// Only need SSR if you're doing a query on the page that needs to be seen for SEO
// =========== Explanation of how SSR works ===============
// me -> browse http://localhost:3000
// -> next.js server
// -> request graphql server at localhost:4000
// -> building the HTML
// -> sending back to your browser
// NextJS only does SSR for first page load... after that it will do client-side renders
// e.g. load index -> go to login page and refresh to clear cache
// -> hit back to index -> it is client-side loaded
export default withUrqlClient(createUrqlClient, { ssr: true })(Index);
