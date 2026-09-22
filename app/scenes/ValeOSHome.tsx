import orderBy from "lodash/orderBy";
import { observer } from "mobx-react";
import { HomeIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { s } from "@shared/styles";
import type { ProsemirrorData } from "@shared/types";
import { Action } from "~/components/Actions";
import DocumentListItem from "~/components/DocumentListItem";
import Heading from "~/components/Heading";
import InputSearchPage from "~/components/InputSearchPage";
import PinnedDocuments from "~/components/PinnedDocuments";
import Scene from "~/components/Scene";
import Time from "~/components/Time";
import useCurrentUser from "~/hooks/useCurrentUser";
import { usePinnedDocuments } from "~/hooks/usePinnedDocuments";
import useStores from "~/hooks/useStores";
import NewDocumentMenu from "~/menus/NewDocumentMenu";

/** The collection whose published documents appear in the What's new feed. */
const UPDATES_COLLECTION_NAME = "Updates";

/** How many posts the What's new feed shows. */
const FEED_LENGTH = 4;

/** How many documents the pick-up-where-you-left-off list shows. */
const RECENT_LENGTH = 6;

/**
 * Collects the plain text of a ProseMirror document, for excerpts.
 *
 * @param node - the ProseMirror data to read.
 * @returns the concatenated text content.
 */
function toPlainText(node: ProsemirrorData | undefined): string {
  if (!node) {
    return "";
  }
  const own = "text" in node && typeof node.text === "string" ? node.text : "";
  const children = Array.isArray(node.content)
    ? node.content.map(toPlainText).join(" ")
    : "";
  return [own, children].filter(Boolean).join(" ");
}

/**
 * The ValeOS home screen: a What's new feed from the Updates collection,
 * curated start-here cards (home pins), and a short recently-viewed list.
 * Replaces upstream's tabbed dashboard for a landing that tells people what
 * changed and where to go.
 */
function ValeOSHome() {
  const { documents, collections } = useStores();
  const user = useCurrentUser();
  const { t } = useTranslation();
  const { pins, count } = usePinnedDocuments("home");

  const updatesCollection = collections.orderedData.find(
    (collection) => collection.name === UPDATES_COLLECTION_NAME
  );

  React.useEffect(() => {
    void documents.fetchRecentlyViewed({ limit: RECENT_LENGTH });
  }, [documents]);

  React.useEffect(() => {
    if (updatesCollection) {
      void documents.fetchNamedPage("list", {
        collectionId: updatesCollection.id,
        sort: "publishedAt",
        direction: "DESC",
        limit: FEED_LENGTH,
      });
    }
  }, [documents, updatesCollection]);

  const updates = updatesCollection
    ? orderBy(
        documents.publishedInCollection(updatesCollection.id),
        "publishedAt",
        "desc"
      ).slice(0, FEED_LENGTH)
    : [];

  const recentlyViewed = documents.recentlyViewed.slice(0, RECENT_LENGTH);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("Good morning") : hour < 17 ? t("Good afternoon") : t("Good evening");
  // Accounts created from an email sign-in may have the address as their
  // name; greet with the mailbox half rather than the full address.
  const firstName = user.name.includes("@")
    ? user.name.split("@")[0]
    : user.name.split(" ")[0];

  return (
    <Scene
      icon={<HomeIcon />}
      title={t("Home")}
      left={
        <InputSearchPage source="dashboard" label={t("Search documents")} />
      }
      actions={
        <Action>
          <NewDocumentMenu />
        </Action>
      }
    >
      <Heading>
        {greeting}, {firstName}
      </Heading>

      {updates.length > 0 && updatesCollection && (
        <Section>
          <SectionTitle>{t("What’s new")}</SectionTitle>
          <Feed>
            {updates.map((document) => {
              const excerpt = toPlainText(document.getSummary(2))
                .replace(document.title, "")
                .trim();
              return (
                <FeedItem key={document.id} to={document.url}>
                  <FeedTitle>{document.titleWithDefault}</FeedTitle>
                  <FeedMeta>
                    {document.createdBy?.name}
                    {document.publishedAt && (
                      <>
                        {" · "}
                        <Time dateTime={document.publishedAt} addSuffix shorten />
                      </>
                    )}
                  </FeedMeta>
                  {excerpt && <FeedExcerpt>{excerpt}</FeedExcerpt>}
                </FeedItem>
              );
            })}
          </Feed>
          <SeeAll to={updatesCollection.path}>
            {t("See all updates")} →
          </SeeAll>
        </Section>
      )}

      {count > 0 && (
        <Section>
          <SectionTitle>{t("Start here")}</SectionTitle>
          <PinnedDocuments
            pins={pins}
            placeholderCount={count}
            collapseKey="home"
          />
        </Section>
      )}

      {recentlyViewed.length > 0 && (
        <Section>
          <SectionTitle>{t("Pick up where you left off")}</SectionTitle>
          {recentlyViewed.map((document) => (
            <DocumentListItem
              key={document.id}
              document={document}
              showCollection
            />
          ))}
        </Section>
      )}
    </Scene>
  );
}

const Section = styled.div`
  margin: 32px 0 0;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: ${s("textTertiary")};
  letter-spacing: 0.02em;
  margin: 0 0 8px;
`;

const Feed = styled.div`
  display: flex;
  flex-direction: column;
`;

const FeedItem = styled(Link)`
  display: block;
  padding: 12px 0;
  border-bottom: 1px solid ${s("divider")};
  color: ${s("text")};

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: ${s("backgroundSecondary")};
    margin: 0 -12px;
    padding: 12px;
    border-radius: 8px;
    border-bottom-color: transparent;
  }
`;

const FeedTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
`;

const FeedMeta = styled.div`
  font-size: 13px;
  color: ${s("textTertiary")};
  margin-top: 2px;
`;

const FeedExcerpt = styled.div`
  font-size: 14px;
  color: ${s("textSecondary")};
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const SeeAll = styled(Link)`
  display: inline-block;
  margin-top: 8px;
  font-size: 14px;
  font-weight: 500;
  color: ${s("textSecondary")};

  &:hover {
    color: ${s("text")};
  }
`;

export default observer(ValeOSHome);
