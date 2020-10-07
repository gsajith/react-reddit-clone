import { withUrqlClient } from "next-urql";
import Layout from "../components/Layout";
import NavBar from "../components/NavBar";
import { usePostsQuery } from "../generated/graphql";
import { createUrqlClient } from "../utils/createUrqlClient";
import NextLink from "next/link";
import { Link } from "@chakra-ui/core";

const Index = () => {
  const [{ data }] = usePostsQuery();
  return (
    <Layout>
      <NextLink href="/create-post">
        <Link>Create post</Link>
      </NextLink>
      <br />
      <br />
      {!data ? (
        <div>Loading...</div>
      ) : (
        data.posts.map((p) => <div key={p.id}>{p.title}</div>)
      )}
    </Layout>
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
