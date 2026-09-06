type LogoProps = {
  className?: string;
  /** Unique suffix so the gradient and clip-path ids stay valid when the logo appears more than once per page. */
  uid?: string;
};

/**
 * Bangladeshi Association of Utah badge: the red sun and Wasatch peaks
 * standing over the Great Salt Lake, inside a deep green ring.
 */
export default function Logo({ className = "", uid = "a" }: LogoProps) {
  const lakeId = `logo-lake-${uid}`;
  const clipId = `logo-inner-${uid}`;
  const titleId = `logo-title-${uid}`;
  const descId = `logo-desc-${uid}`;

  return (
    <svg
      viewBox="137 137 980 980"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>
        Bangladeshi Association of Utah, Salt Lake City logo
      </title>
      <desc id={descId}>
        Circular green association badge with a red sun, green outlined mountain
        peaks, green shoreline, and blue lake.
      </desc>

      <defs>
        <linearGradient id={lakeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35A8E6" />
          <stop offset="1" stopColor="#1286D4" />
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx="627" cy="627" r="490" />
        </clipPath>
      </defs>

      <circle cx="627" cy="627" r="490" fill="#FBF8EF" />

      <g clipPath={`url(#${clipId})`}>
        <circle cx="627" cy="625" r="248" fill="#F42A41" />
        <circle
          cx="627"
          cy="625"
          r="280"
          fill="none"
          stroke="#F4435D"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="14 13"
        />
        <circle
          cx="627"
          cy="625"
          r="315"
          fill="none"
          stroke="#F56B7D"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="14 13"
        />
        <circle
          cx="627"
          cy="625"
          r="347"
          fill="none"
          stroke="#F79AA8"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="14 13"
        />

        <rect
          x="130"
          y="838"
          width="994"
          height="410"
          fill={`url(#${lakeId})`}
        />
        <path
          d="M188 850 C330 840 492 842 670 850 C808 856 932 844 1066 849"
          fill="none"
          stroke="#A7E8F6"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M216 884 C345 875 505 875 669 883 C808 891 922 876 1040 881"
          fill="none"
          stroke="#8DDAF1"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M244 928 C385 917 535 919 674 928 C808 938 918 922 1020 928"
          fill="none"
          stroke="#8DDAF1"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M280 975 C400 964 548 967 664 975 C794 985 898 973 986 977"
          fill="none"
          stroke="#79CFEA"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M330 1020 C443 1010 548 1012 652 1019 C756 1026 844 1019 931 1022"
          fill="none"
          stroke="#79CFEA"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <path
          d="M 765 810 L 699 736 L 659 696 L 639 712 L 607 742 L 562 787 L 536 816 L 608 767 L 611 767 L 612 770 L 598 797 L 669 739 L 673 739 L 700 763 L 738 793 Z M 990 823 L 989 826 L 965 822 L 911 821 L 850 809 L 815 807 L 796 809 L 754 818 L 715 822 L 675 830 L 643 833 L 611 833 L 555 827 L 472 809 L 435 807 L 415 809 L 373 818 L 352 821 L 279 820 L 255 824 L 238 829 L 233 828 L 234 825 L 260 810 L 312 773 L 319 772 L 334 774 L 335 777 L 310 811 L 346 786 L 395 744 L 420 725 L 425 723 L 426 724 L 425 728 L 373 802 L 398 783 L 424 757 L 482 680 L 527 629 L 530 629 L 546 655 L 547 660 L 514 708 L 472 779 L 547 691 L 561 676 L 563 676 L 564 680 L 532 759 L 575 694 L 627 605 L 654 568 L 656 568 L 659 571 L 698 637 L 719 669 L 741 698 L 715 629 L 715 625 L 727 614 L 730 614 L 733 617 L 791 703 L 820 742 L 852 781 L 867 797 L 839 744 L 822 715 L 824 711 L 845 699 L 847 699 L 878 734 L 892 761 L 913 795 L 903 765 L 904 761 L 906 761 L 922 776 L 947 796 L 972 813 Z M 1093 471 L 1091 471 L 1104 513 L 1109 536 L 1115 576 L 1117 602 L 1116 668 L 1109 719 L 1100 758 L 1083 808 L 1075 827 L 1067 841 L 1055 839 L 1040 834 L 1018 823 L 989 804 L 966 786 L 939 762 L 911 734 L 850 666 L 810 685 L 739 580 L 736 579 L 714 591 L 710 591 L 655 511 L 633 534 L 558 619 L 554 617 L 527 586 L 437 682 L 388 719 L 353 748 L 304 747 L 244 798 L 198 830 L 186 836 L 183 836 L 181 834 L 170 809 L 156 767 L 172 814 L 191 854 L 189 850 L 190 846 L 257 840 L 332 836 L 438 836 L 498 840 L 565 847 L 596 849 L 628 849 L 629 850 L 705 848 L 836 838 L 934 837 L 988 840 L 1062 848 L 1063 852 L 1051 874 L 1052 874 L 1076 828 L 1089 796 L 1098 769 L 1108 730 L 1116 681 L 1118 658 L 1118 596 L 1116 573 L 1108 524 Z"
          fill="#006A4E"
          fillRule="evenodd"
        />
        <path
          d="M 761 805 L 759 807 L 741 795 L 699 762 L 673 739 L 669 739 L 601 794 L 600 792 L 614 767 L 614 764 L 612 764 L 542 812 L 540 811 L 570 779 L 624 726 L 659 696 L 695 732 Z M 997 826 L 984 820 L 960 805 L 927 780 L 905 760 L 903 760 L 911 787 L 910 790 L 892 761 L 878 734 L 847 699 L 845 699 L 822 712 L 822 715 L 863 789 L 862 791 L 837 763 L 814 734 L 782 690 L 730 613 L 728 613 L 715 625 L 715 628 L 740 694 L 739 695 L 735 691 L 695 632 L 657 568 L 654 567 L 625 608 L 573 697 L 536 753 L 535 750 L 557 694 L 566 675 L 566 672 L 564 672 L 545 693 L 484 766 L 478 772 L 477 771 L 517 703 L 547 660 L 544 652 L 530 628 L 528 628 L 481 681 L 422 759 L 402 779 L 379 798 L 377 797 L 428 724 L 430 719 L 428 719 L 400 740 L 369 765 L 342 789 L 314 809 L 312 808 L 336 776 L 336 774 L 312 773 L 266 806 L 227 829 L 227 831 L 275 820 L 301 819 L 317 821 L 347 821 L 377 817 L 396 812 L 429 807 L 459 807 L 474 809 L 540 824 L 601 832 L 665 831 L 692 827 L 719 821 L 752 818 L 788 810 L 810 807 L 846 808 L 906 820 L 956 821 L 981 824 L 993 828 L 997 828 Z"
          fill="#FBF8EF"
          fillRule="evenodd"
        />
      </g>

      <circle
        cx="627"
        cy="627"
        r="484"
        fill="none"
        stroke="#00543D"
        strokeWidth="12"
      />
    </svg>
  );
}
